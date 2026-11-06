#!/usr/bin/env python3
"""Generate dev/.env.local secrets from dev/.env.local.example.

If the output already exists, only variables it does not define yet are appended,
so existing secrets and database passwords are kept.

Global agent material (SaaS signing key and identity GLOBAL_JWKS) is always derived
from the same private PEM. On every run, GLOBAL_JWKS and GLOBAL_AGENT_SIGNING_KID
are recomputed from GLOBAL_AGENT_SIGNING_KEY so a stale JWKS cannot drift from
the PEM. Sensitive values are never printed.
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
    if (s.startswith('"') and s.endswith('"')) or (s.startswith("'") and s.endswith("'")):
        s = s[1:-1]
    s = s.replace("\\n", "\n")
    if "BEGIN RSA PRIVATE KEY" in s or "BEGIN PRIVATE KEY" in s:
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


def extract_global_agent_private_pem(env_body: str) -> str | None:
    """Prefer GLOBAL_AGENT_SIGNING_KEY; accept legacy GLOBAL_AGENT_PRIVATE_KEY."""
    for key in ("GLOBAL_AGENT_SIGNING_KEY", "GLOBAL_AGENT_PRIVATE_KEY"):
        for line in env_body.splitlines():
            if line.startswith(key + "="):
                raw = line.split("=", 1)[1].strip()
                pem = unescape_env_pem(raw)
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


def global_agent_updates_from_private(private_pem: str, audience_template: str) -> dict[str, str]:
    public_pem = public_pem_from_private(private_pem)
    kid = kid_from_private_pem(private_pem)
    jwks_obj = jwks_for_rsa_public_pem(public_pem, kid)
    jwks_quoted = "'" + jwks_obj + "'"
    # audience may reference ${PUBLIC_SAAS_URL}; keep literal from template
    return {
        "GLOBAL_AGENT_SIGNING_KEY": '"' + pem_for_env(private_pem) + '"',
        "GLOBAL_AGENT_SIGNING_KID": kid,
        "GLOBAL_JWKS": jwks_quoted,
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
    global_private_pem: str,
    global_kid: str,
    global_jwks_quoted: str,
) -> str:
    text = example_path.read_text(encoding="utf-8")
    pem_env = pem_for_env(global_private_pem)

    replacements = {
        "__POSTGRES_PASSWORD__": secrets.token_urlsafe(24),
        "__IDENTITY_SECRET_KEY__": secret_key(),
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
        "__GLOBAL_AGENT_SIGNING_KEY__": '"' + pem_env + '"',
        "__GLOBAL_AGENT_JWKS_JSON__": global_jwks_quoted,
        "__GLOBAL_AGENT_SIGNING_KID__": global_kid,
        "__DASHBOARD_WEBHOOK_SECRET__": secrets.token_urlsafe(32),
        "__EMAIL_CREDENTIALS_KEY__": fernet_key(),
        "__EMAIL_VARIABLES_KEY__": fernet_key(),
        "__EMAIL_HASH_PEPPER__": secrets.token_urlsafe(32),
    }

    jwt_private, jwt_public, jwt_kid = rsa_keypair()
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
    text = re.sub(r"__ESK_[A-Z]+__", lambda _match: esk_key(), text)

    if re.search(r"__[-A-Z0-9_]+__", text):
        print("Unresolved placeholders remain in output", file=sys.stderr)
        raise SystemExit(1)
    return text


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

    existing_pem: str | None = None
    audience_from_file: str | None = None
    if output_path.exists():
        cur = output_path.read_text(encoding="utf-8")
        existing_pem = extract_global_agent_private_pem(cur)
        audience_from_file = extract_value(cur, "GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE")

    audience_template = audience_from_file if audience_from_file else audience_from_example

    if existing_pem:
        global_private = existing_pem
        global_public = public_pem_from_private(global_private)
        global_kid = kid_from_private_pem(global_private)
        global_jwks_quoted = "'" + jwks_for_rsa_public_pem(global_public, global_kid) + "'"
    else:
        global_private, global_public, global_kid = rsa_keypair()
        global_jwks_quoted = "'" + jwks_for_rsa_public_pem(global_public, global_kid) + "'"

    text = apply_example(example_path, global_private, global_kid, global_jwks_quoted)

    ga_updates = global_agent_updates_from_private(global_private, audience_template)

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
                or line.startswith("GLOBAL_AGENT_KEY_ID=")
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
