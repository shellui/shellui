#!/usr/bin/env python3
"""Generate dev/.env.local secrets from dev/.env.local.example.

If the output already exists, only variables it does not define yet are appended,
so existing secrets and database passwords are kept.

Two issuers, two keys. identity-global's JWT private key is the user issuer.
GLOBAL_JWKS is that public key. SaaS mints global agent tokens with a
different PEM (GLOBAL_AGENT_SIGNING_KEY). GLOBAL_AGENT_JWKS and
GLOBAL_AGENT_KEY_ID are recomputed from that PEM on every run.
GLOBAL_AGENT_KEY_ID is the kid SaaS puts on agent tokens. An existing file
keeps both private keys. If they are the same PEM, identity-global is given
a new key and the SaaS key is left as it is. Sensitive values are never printed.
"""

from __future__ import annotations

import base64
import hashlib
import json
import re
import secrets
import subprocess
import sys
from pathlib import Path

try:
    from cryptography.hazmat.primitives import serialization as _crypt_ser
    from cryptography.hazmat.primitives.asymmetric import rsa as _crypt_rsa

    _HAVE_CRYPTO = True
except ImportError:
    _HAVE_CRYPTO = False


def secret_key() -> str:
    return secrets.token_urlsafe(64)


def fernet_key() -> str:
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()


def kid_from_private_pem(private_pem: str) -> str:
    pub_der = subprocess.check_output(
        ["openssl", "rsa", "-pubout", "-outform", "DER"],
        input=private_pem.encode(),
    )
    digest = hashlib.sha256(pub_der).digest()
    return base64.urlsafe_b64encode(digest[:16]).rstrip(b"=").decode("ascii")


def rsa_keypair(bits: int = 2048) -> tuple[str, str, str]:
    private_pem = subprocess.check_output(["openssl", "genrsa", str(bits)], text=True, stderr=subprocess.DEVNULL)
    public_pem = subprocess.check_output(
        ["openssl", "rsa", "-pubout"],
        input=private_pem,
        text=True,
    )
    kid = kid_from_private_pem(private_pem)
    return private_pem, public_pem, kid


def pem_for_env(pem: str) -> str:
    return pem.strip().replace("\n", "\\n")


def unescape_env_pem(raw: str) -> str | None:
    """Unquote a PEM stored on one line with \\n escapes. Returns None if not a PEM."""
    s = raw.strip()
    while (len(s) >= 2) and (
        (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'"))
    ):
        s = s[1:-1].strip()
    s = s.replace("\\n", "\n")
    start = s.find("-----BEGIN")
    if start < 0:
        return None
    s = s[start:]
    if "BEGIN RSA PRIVATE KEY" in s or "BEGIN PRIVATE KEY" in s:
        if not s.endswith("\n"):
            s += "\n"
        return s
    return None


def jwks_for_rsa_public_pem(public_pem: str, kid: str) -> str:
    """Single-key JWKS JSON for RS256 global agent verification (identity GLOBAL_JWKS)."""
    if _HAVE_CRYPTO:
        key = _crypt_ser.load_pem_public_key(public_pem.encode("utf-8"))
        if not isinstance(key, _crypt_rsa.RSAPublicKey):
            raise TypeError("expected RSA public key")
        numbers = key.public_numbers()
        n = base64.urlsafe_b64encode(
            numbers.n.to_bytes((numbers.n.bit_length() + 7) // 8, "big"),
        ).rstrip(b"=").decode("ascii")
        e = base64.urlsafe_b64encode(
            numbers.e.to_bytes((numbers.e.bit_length() + 7) // 8, "big"),
        ).rstrip(b"=").decode("ascii")
    else:
        mod_line = subprocess.check_output(
            ["openssl", "rsa", "-pubin", "-inform", "PEM", "-modulus", "-noout"],
            input=public_pem,
            text=True,
        ).strip()
        if not mod_line.startswith("Modulus="):
            raise ValueError("unexpected openssl -modulus output")
        mod_hex = mod_line.split("=", 1)[1].lower()
        mod_bytes = bytes.fromhex(mod_hex)
        n = base64.urlsafe_b64encode(mod_bytes).rstrip(b"=").decode("ascii")
        exp_line = subprocess.check_output(
            ["openssl", "rsa", "-pubin", "-inform", "PEM", "-text", "-noout"],
            input=public_pem,
            text=True,
        )
        m = re.search(r"Exponent:\s*(\d+)", exp_line)
        exp_int = int(m.group(1)) if m else 65537
        e = base64.urlsafe_b64encode(exp_int.to_bytes((exp_int.bit_length() + 7) // 8, "big")).rstrip(
            b"=",
        ).decode("ascii")
    doc = {"keys": [{"kty": "RSA", "kid": kid, "use": "sig", "alg": "RS256", "n": n, "e": e}]}
    return json.dumps(doc, separators=(",", ":"))


def public_pem_from_private(private_pem: str) -> str:
    return subprocess.check_output(
        ["openssl", "rsa", "-pubout"],
        input=private_pem,
        text=True,
    )


def extract_private_pem(env_body: str, key: str) -> str | None:
    for line in env_body.splitlines():
        if line.startswith(key + "="):
            return unescape_env_pem(line.split("=", 1)[1].strip())
    return None


def extract_global_agent_private_pem(env_body: str) -> str | None:
    """Prefer GLOBAL_AGENT_SIGNING_KEY; accept legacy GLOBAL_AGENT_PRIVATE_KEY."""
    for key in ("GLOBAL_AGENT_SIGNING_KEY", "GLOBAL_AGENT_PRIVATE_KEY"):
        pem = extract_private_pem(env_body, key)
        if pem:
            return pem
    return None


def extract_value(env_body: str, key: str) -> str | None:
    prefix = key + "="
    for line in env_body.splitlines():
        if line.startswith(prefix):
            return line.split("=", 1)[1].strip()
    return None


def replace_env_lines(body: str, updates: dict[str, str]) -> str:
    """Replace or append KEY= lines."""
    lines = body.splitlines()
    keys_done = set()
    out_lines: list[str] = []
    for line in lines:
        name = var_name(line)
        if name and name in updates:
            out_lines.append(f"{name}={updates[name]}")
            keys_done.add(name)
        else:
            out_lines.append(line)
    for key, val in updates.items():
        if key not in keys_done:
            out_lines.append(f"{key}={val}")
    return "\n".join(out_lines) + ("\n" if body.endswith("\n") or not body else "")


def jwks_quoted_for_keys(pairs: list[tuple[str, str]]) -> str:
    """Single-quoted JWKS. ``pairs`` is ``(public_pem, kid)``, first key wins on kid."""
    keys: list[dict] = []
    seen: set[str] = set()
    for public_pem, kid in pairs:
        if kid in seen:
            continue
        seen.add(kid)
        doc = json.loads(jwks_for_rsa_public_pem(public_pem, kid))
        keys.append(doc["keys"][0])
    return "'" + json.dumps({"keys": keys}, separators=(",", ":")) + "'"


def oidc_clients_env(client_id: str, client_secret: str) -> str:
    """Single-quoted OIDC_CLIENTS JSON for the regional relying party."""
    doc = [
        {
            "client_id": client_id,
            "client_secret": client_secret,
            "redirect_uris": [
                "http://localhost:8001/oauth/upstream-callback",
                "http://localhost:8001/oauth/mcp/saas-return",
            ],
            "backchannel_logout_uri": "http://localhost:8001/oauth/backchannel-logout",
        }
    ]
    return "'" + json.dumps(doc, separators=(",", ":")) + "'"


def quoted_pem(private_pem: str) -> str:
    return '"' + pem_for_env(private_pem) + '"'


def trust_material_updates(
    *,
    issuer_private_pem: str,
    issuer_kid: str,
    issuer_jwks_quoted: str,
    agent_private_pem: str,
    agent_kid: str,
    agent_jwks_quoted: str,
    audience_template: str,
) -> dict[str, str]:
    """Lines rewritten every run so each JWKS matches its private key."""
    issuer_public = public_pem_from_private(issuer_private_pem)
    return {
        "IDENTITY_GLOBAL_JWT_PRIVATE_KEY": quoted_pem(issuer_private_pem),
        "IDENTITY_GLOBAL_JWT_PUBLIC_KEY": quoted_pem(issuer_public),
        "IDENTITY_GLOBAL_JWT_KEY_ID": issuer_kid,
        "GLOBAL_JWKS": issuer_jwks_quoted,
        "GLOBAL_AGENT_SIGNING_KEY": quoted_pem(agent_private_pem),
        "GLOBAL_AGENT_KEY_ID": agent_kid,
        "GLOBAL_AGENT_JWKS": agent_jwks_quoted,
        "GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE": audience_template,
    }


def esk_key() -> str:
    return "esk_" + secrets.token_urlsafe(32)


def var_name(line: str) -> str:
    match = re.match(r"([A-Z][A-Z0-9_]*)=", line)
    return match.group(1) if match else ""


def defined(text: str) -> set[str]:
    return {name for line in text.splitlines() if (name := var_name(line))}


def apply_example(
    example_path: Path,
    *,
    issuer_private_pem: str,
    issuer_kid: str,
    issuer_jwks_quoted: str,
    agent_private_pem: str,
    agent_kid: str,
    agent_jwks_quoted: str,
    oidc_client_id: str,
    oidc_client_secret: str,
) -> str:
    text = example_path.read_text(encoding="utf-8")
    issuer_public = public_pem_from_private(issuer_private_pem)

    replacements = {
        "__POSTGRES_PASSWORD__": secrets.token_urlsafe(24),
        "__IDENTITY_SECRET_KEY__": secret_key(),
        "__IDENTITY_GLOBAL_SECRET_KEY__": secret_key(),
        "__STORAGE_SECRET_KEY__": secret_key(),
        "__HOSTING_SECRET_KEY__": secret_key(),
        "__EMAIL_SECRET_KEY__": secret_key(),
        "__SAAS_SECRET_KEY__": secret_key(),
        "__AI_SECRET_KEY__": secret_key(),
        "__JWT_PRIVATE_KEY__": "",  # filled below
        "__JWT_PUBLIC_KEY__": "",  # filled below
        "__JWT_KEY_ID__": "",  # filled below
        "__AI_SERVICE_SIGNING_KEY__": "",  # filled below
        "__AI_SERVICE_SIGNING_KID__": "",  # filled below
        "__STORAGE_SERVICE_SIGNING_KEY__": "",  # filled below
        "__HOSTING_SERVICE_SIGNING_KEY__": "",  # filled below
        "__EMAIL_SERVICE_SIGNING_KEY__": "",  # filled below
        "__PROVISIONING_SIGNING_KEY__": "",  # filled below
        "__PROVISIONING_PUBLIC_KEY__": "",  # filled below
        "__GLOBAL_AGENT_SIGNING_KEY__": pem_for_env(agent_private_pem),
        "__GLOBAL_AGENT_JWKS_JSON__": agent_jwks_quoted,
        "__GLOBAL_AGENT_KEY_ID__": agent_kid,
        "__GLOBAL_JWKS_JSON__": issuer_jwks_quoted,
        "__GLOBAL_OIDC_CLIENT_ID__": oidc_client_id,
        "__GLOBAL_OIDC_CLIENT_SECRET__": oidc_client_secret,
        "__IDENTITY_GLOBAL_OIDC_CLIENTS__": oidc_clients_env(oidc_client_id, oidc_client_secret),
        "__DASHBOARD_WEBHOOK_SECRET__": secrets.token_urlsafe(32),
        "__EMAIL_CREDENTIALS_KEY__": fernet_key(),
        "__EMAIL_VARIABLES_KEY__": fernet_key(),
        "__EMAIL_HASH_PEPPER__": secrets.token_urlsafe(32),
    }

    jwt_private, jwt_public, jwt_kid = rsa_keypair()
    replacements["__IDENTITY_GLOBAL_JWT_PRIVATE_KEY__"] = pem_for_env(issuer_private_pem)
    replacements["__IDENTITY_GLOBAL_JWT_PUBLIC_KEY__"] = pem_for_env(issuer_public)
    replacements["__IDENTITY_GLOBAL_JWT_KEY_ID__"] = issuer_kid
    ai_private, _ai_public, ai_kid = rsa_keypair()
    storage_private, _storage_public, _ = rsa_keypair()
    hosting_private, _hosting_public, _ = rsa_keypair()
    email_private, _email_public, _ = rsa_keypair()
    provisioning_private, provisioning_public, _ = rsa_keypair()

    replacements["__JWT_PRIVATE_KEY__"] = pem_for_env(jwt_private)
    replacements["__JWT_PUBLIC_KEY__"] = pem_for_env(jwt_public)
    replacements["__JWT_KEY_ID__"] = jwt_kid
    replacements["__AI_SERVICE_SIGNING_KEY__"] = pem_for_env(ai_private)
    replacements["__AI_SERVICE_SIGNING_KID__"] = ai_kid
    replacements["__STORAGE_SERVICE_SIGNING_KEY__"] = pem_for_env(storage_private)
    replacements["__HOSTING_SERVICE_SIGNING_KEY__"] = pem_for_env(hosting_private)
    replacements["__EMAIL_SERVICE_SIGNING_KEY__"] = pem_for_env(email_private)
    replacements["__PROVISIONING_SIGNING_KEY__"] = pem_for_env(provisioning_private)
    replacements["__PROVISIONING_PUBLIC_KEY__"] = pem_for_env(provisioning_public)

    for marker, value in replacements.items():
        text = text.replace(marker, value)
    text = re.sub(r"__ESK_[A-Z_]+__", lambda _match: esk_key(), text)

    if re.search(r"__[-A-Z0-9_]+__", text):
        print("Unresolved placeholders remain in output", file=sys.stderr)
        raise SystemExit(1)
    return text


def _unquote_plain(raw: str | None) -> str | None:
    if raw is None:
        return None
    s = raw.strip()
    while len(s) >= 2 and s[0] == s[-1] and s[0] in {'"', "'"}:
        s = s[1:-1].strip()
    return s or None


def _existing_oidc_client(env_body: str) -> tuple[str, str] | None:
    raw = _unquote_plain(extract_value(env_body, "IDENTITY_GLOBAL_OIDC_CLIENTS"))
    if not raw:
        return None
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, list) or not data or not isinstance(data[0], dict):
        return None
    client_id = str(data[0].get("client_id") or "").strip()
    secret = str(data[0].get("client_secret") or "")
    if client_id and secret:
        return client_id, secret
    return None


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: generate_env.py <example> <output>", file=sys.stderr)
        return 2

    example_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    example_raw = example_path.read_text(encoding="utf-8")
    aud_match = re.search(
        r"^GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE=(.+)$",
        example_raw,
        re.MULTILINE,
    )
    audience_from_example = aud_match.group(1).strip() if aud_match else "shellui_global_agent_dev"

    existing_body = output_path.read_text(encoding="utf-8") if output_path.exists() else ""
    audience_from_file = extract_value(existing_body, "GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE") if existing_body else None
    audience_template = audience_from_file if audience_from_file else audience_from_example

    issuer_pem = extract_private_pem(existing_body, "IDENTITY_GLOBAL_JWT_PRIVATE_KEY") if existing_body else None
    agent_pem = extract_global_agent_private_pem(existing_body) if existing_body else None
    if issuer_pem and agent_pem and issuer_pem.strip() == agent_pem.strip():
        print(
            "IDENTITY_GLOBAL_JWT_PRIVATE_KEY matched GLOBAL_AGENT_SIGNING_KEY; "
            "generated a new identity-global key. The SaaS agent key is unchanged.",
            file=sys.stderr,
        )
        issuer_pem = None
    if not issuer_pem:
        issuer_pem, _public, _kid = rsa_keypair()
    if not agent_pem:
        agent_pem, _public, _kid = rsa_keypair()
    if issuer_pem.strip() == agent_pem.strip():
        issuer_pem, _public, _kid = rsa_keypair()

    issuer_public = public_pem_from_private(issuer_pem)
    issuer_kid = kid_from_private_pem(issuer_pem)
    agent_public = public_pem_from_private(agent_pem)
    agent_kid = kid_from_private_pem(agent_pem)
    issuer_jwks_quoted = jwks_quoted_for_keys([(issuer_public, issuer_kid)])
    agent_jwks_quoted = jwks_quoted_for_keys([(agent_public, agent_kid)])

    parsed_client = _existing_oidc_client(existing_body) if existing_body else None
    client_id = _unquote_plain(extract_value(existing_body, "GLOBAL_CLIENT_ID")) if existing_body else None
    client_secret = _unquote_plain(extract_value(existing_body, "GLOBAL_CLIENT_SECRET")) if existing_body else None
    if parsed_client:
        client_id = client_id or parsed_client[0]
        client_secret = client_secret or parsed_client[1]
    if not client_id:
        client_id = "region-dev-" + secrets.token_urlsafe(9)
    if not client_secret:
        client_secret = secrets.token_urlsafe(32)

    text = apply_example(
        example_path,
        issuer_private_pem=issuer_pem,
        issuer_kid=issuer_kid,
        issuer_jwks_quoted=issuer_jwks_quoted,
        agent_private_pem=agent_pem,
        agent_kid=agent_kid,
        agent_jwks_quoted=agent_jwks_quoted,
        oidc_client_id=client_id,
        oidc_client_secret=client_secret,
    )

    ga_updates = trust_material_updates(
        issuer_private_pem=issuer_pem,
        issuer_kid=issuer_kid,
        issuer_jwks_quoted=issuer_jwks_quoted,
        agent_private_pem=agent_pem,
        agent_kid=agent_kid,
        agent_jwks_quoted=agent_jwks_quoted,
        audience_template=audience_template,
    )

    if output_path.exists():
        current = output_path.read_text(encoding="utf-8")
        # Sync global agent triple from canonical PEM so JWKS never mismatches.
        current = replace_env_lines(current, ga_updates)
        # Drop legacy duplicate keys if present.
        current = "\n".join(
            line
            for line in current.splitlines()
            if not (
                line.startswith("GLOBAL_AGENT_PRIVATE_KEY=")
                or line.startswith("GLOBAL_AGENT_SIGNING_KID=")
            )
        )
        if not current.endswith("\n"):
            current += "\n"

        missing = [line for line in text.splitlines() if (name := var_name(line)) and name not in defined(current)]
        if missing:
            output_path.write_text(current.rstrip("\n") + "\n" + "\n".join(missing) + "\n", encoding="utf-8")
            print("Added " + ", ".join(var_name(line) for line in missing), file=sys.stderr)
        else:
            output_path.write_text(current, encoding="utf-8")
        return 0

    output_path.write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
