#!/usr/bin/env python3
"""Fill empty secrets in deploy/.env and write deploy/secrets/jwks.json.

No secret values are printed. Safe to run again: existing generated secrets are
kept. JWT_PUBLIC_KEY, JWT_KEY_ID, and IDENTITY_JWKS are rewritten from
JWT_PRIVATE_KEY. When JWT_PREVIOUS_PUBLIC_KEY is set, that public key stays in
the JWKS next to the current key.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import json
import os
import re
import secrets
import shlex
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_PATH = ROOT / ".env"
EXAMPLE_PATH = ROOT / ".env.example"
SECRETS_DIR = ROOT / "secrets"
JWKS_PATH = SECRETS_DIR / "jwks.json"

HEX_KEYS = (
    "POSTGRES_PASSWORD",
    "IDENTITY_DB_PASSWORD",
    "STORAGE_DB_PASSWORD",
    "HOSTING_DB_PASSWORD",
    "EMAIL_DB_PASSWORD",
)
TOKEN_KEYS = (
    "IDENTITY_SECRET_KEY",
    "STORAGE_SECRET_KEY",
    "HOSTING_SECRET_KEY",
    "EMAIL_SECRET_KEY",
    "EMAIL_HASH_PEPPER",
)
FERNET_KEYS = (
    "EMAIL_CREDENTIALS_KEY",
    "EMAIL_VARIABLES_KEY",
)
DATABASE_URLS = (
    ("IDENTITY_DATABASE_URL", "identity", "IDENTITY_DB_PASSWORD", "identity"),
    ("STORAGE_DATABASE_URL", "storage", "STORAGE_DB_PASSWORD", "storage"),
    ("HOSTING_DATABASE_URL", "hosting", "HOSTING_DB_PASSWORD", "hosting"),
    ("EMAIL_DATABASE_URL", "email", "EMAIL_DB_PASSWORD", "email"),
)

ASSIGNMENT = re.compile(r"^([A-Za-z_][A-Za-z0-9_]*)=(.*)$")


def read_env(path: Path) -> tuple[list[str], dict[str, str]]:
    lines = path.read_text(encoding="utf-8").splitlines(keepends=True) if path.exists() else []
    values: dict[str, str] = {}
    for raw in lines:
        stripped = raw.strip()
        if not stripped or stripped.startswith("#"):
            continue
        match = ASSIGNMENT.match(stripped)
        if match:
            values[match.group(1)] = unquote(match.group(2))
    return lines, values


def unquote(value: str) -> str:
    """Reverse quote_env. Quoted values unescape \\\\, \\\", and \\n."""
    value = value.strip()
    if len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
        inner = value[1:-1]
        out: list[str] = []
        index = 0
        while index < len(inner):
            if inner[index] == "\\" and index + 1 < len(inner):
                nxt = inner[index + 1]
                if nxt == "n":
                    out.append("\n")
                elif nxt == '"':
                    out.append('"')
                elif nxt == "\\":
                    out.append("\\")
                else:
                    out.append(nxt)
                index += 2
                continue
            out.append(inner[index])
            index += 1
        return "".join(out)
    return value


def quote_env(value: str) -> str:
    """One-line .env value. PEM newlines are stored as literal \\n sequences."""
    if "\n" in value:
        escaped = value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
        return f'"{escaped}"'
    if value == "" or re.search(r'[\s#"\']', value):
        escaped = value.replace("\\", "\\\\").replace('"', '\\"')
        return f'"{escaped}"'
    return value


def set_values(path: Path, updates: dict[str, str]) -> None:
    lines, _values = read_env(path)
    if not lines and path.exists():
        lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    seen: set[str] = set()
    new_lines: list[str] = []
    for raw in lines:
        stripped = raw.strip()
        match = ASSIGNMENT.match(stripped) if stripped and not stripped.startswith("#") else None
        if match and match.group(1) in updates:
            key = match.group(1)
            new_lines.append(f"{key}={quote_env(updates[key])}\n")
            seen.add(key)
            continue
        if raw.endswith("\n") or raw == "":
            new_lines.append(raw if raw.endswith("\n") or not raw else raw)
        else:
            new_lines.append(raw + "\n")
    missing = [key for key in updates if key not in seen]
    if missing and new_lines and not new_lines[-1].endswith("\n"):
        new_lines[-1] += "\n"
    for key in missing:
        new_lines.append(f"{key}={quote_env(updates[key])}\n")
    path.write_text("".join(new_lines), encoding="utf-8")
    os.chmod(path, 0o600)


def empty(values: dict[str, str], key: str) -> bool:
    return not values.get(key, "").strip()


def fernet_key() -> str:
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode("ascii")


def b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def read_der_length(data: bytes, index: int) -> tuple[int, int]:
    first = data[index]
    index += 1
    if first < 0x80:
        return first, index
    count = first & 0x7F
    if count == 0 or count > 4:
        raise ValueError("unsupported ASN.1 length")
    length = int.from_bytes(data[index : index + count], "big")
    return length, index + count


def parse_spki_rsa(der: bytes) -> tuple[int, int]:
    """Return the RSA modulus and exponent from a SubjectPublicKeyInfo DER."""
    if der[0] != 0x30:
        raise ValueError("public key is not an ASN.1 sequence")
    _, index = read_der_length(der, 1)
    if der[index] != 0x30:
        raise ValueError("missing algorithm sequence")
    algorithm_length, index = read_der_length(der, index + 1)
    index += algorithm_length
    if der[index] != 0x03:
        raise ValueError("missing public key bit string")
    _, index = read_der_length(der, index + 1)
    if der[index] != 0x00:
        raise ValueError("unexpected bit-string padding")
    index += 1
    if der[index] != 0x30:
        raise ValueError("missing RSA public key sequence")
    _, index = read_der_length(der, index + 1)

    def read_integer(at: int) -> tuple[int, int]:
        if der[at] != 0x02:
            raise ValueError("expected an ASN.1 integer")
        length, cursor = read_der_length(der, at + 1)
        raw = der[cursor : cursor + length]
        if raw[:1] == b"\x00":
            raw = raw[1:]
        return int.from_bytes(raw, "big"), cursor + length

    modulus, index = read_integer(index)
    exponent, _index = read_integer(index)
    return modulus, exponent


def jwk_rsa(modulus: int, exponent: int, kid: str = "") -> tuple[str, dict]:
    """RFC 7638 thumbprint plus a public JWK. ``kid`` overrides the thumbprint."""
    modulus_b64 = b64url(modulus.to_bytes((modulus.bit_length() + 7) // 8, "big"))
    exponent_b64 = b64url(exponent.to_bytes((exponent.bit_length() + 7) // 8, "big"))
    canonical = json.dumps(
        {"e": exponent_b64, "kty": "RSA", "n": modulus_b64},
        separators=(",", ":"),
        sort_keys=True,
    )
    thumbprint = b64url(hashlib.sha256(canonical.encode("ascii")).digest())
    jwk = {
        "kty": "RSA",
        "use": "sig",
        "alg": "RS256",
        "kid": kid.strip() or thumbprint,
        "n": modulus_b64,
        "e": exponent_b64,
    }
    return thumbprint, jwk


def jwk_from_private_pem(private_pem: str) -> tuple[str, str, dict]:
    with tempfile.TemporaryDirectory() as tmp:
        private_path = Path(tmp) / "private.pem"
        private_path.write_text(private_pem if private_pem.endswith("\n") else private_pem + "\n", encoding="utf-8")
        os.chmod(private_path, 0o600)
        public_pem = subprocess.check_output(
            ["openssl", "pkey", "-in", str(private_path), "-pubout"],
            text=True,
        )
        der = subprocess.check_output(
            ["openssl", "pkey", "-in", str(private_path), "-pubout", "-outform", "DER"]
        )
    modulus, exponent = parse_spki_rsa(der)
    kid, jwk = jwk_rsa(modulus, exponent)
    return public_pem.strip() + "\n", kid, jwk


def jwk_from_public_pem(public_pem: str, kid: str = "") -> dict:
    text = public_pem if public_pem.endswith("\n") else public_pem + "\n"
    with tempfile.TemporaryDirectory() as tmp:
        public_path = Path(tmp) / "public.pem"
        public_path.write_text(text, encoding="utf-8")
        der = subprocess.check_output(
            ["openssl", "pkey", "-pubin", "-in", str(public_path), "-outform", "DER"]
        )
    modulus, exponent = parse_spki_rsa(der)
    _thumbprint, jwk = jwk_rsa(modulus, exponent, kid)
    return jwk


def generate_private_pem() -> str:
    return subprocess.check_output(
        ["openssl", "genpkey", "-algorithm", "RSA", "-pkeyopt", "rsa_keygen_bits:3072"],
        text=True,
    )


def fill_secrets() -> None:
    if not ENV_PATH.exists():
        if not EXAMPLE_PATH.exists():
            sys.exit(f"missing {EXAMPLE_PATH}")
        ENV_PATH.write_text(EXAMPLE_PATH.read_text(encoding="utf-8"), encoding="utf-8")
        os.chmod(ENV_PATH, 0o600)
        print("copied .env.example to .env")

    _lines, values = read_env(ENV_PATH)
    updates: dict[str, str] = {}

    for key in HEX_KEYS:
        if empty(values, key):
            updates[key] = secrets.token_hex(32)
    for key in TOKEN_KEYS:
        if empty(values, key):
            updates[key] = secrets.token_urlsafe(64)
    for key in FERNET_KEYS:
        if empty(values, key):
            updates[key] = fernet_key()

    values.update(updates)
    for url_key, user, password_key, database in DATABASE_URLS:
        if empty(values, url_key):
            password = values.get(password_key, "")
            if not password:
                sys.exit(f"cannot build {url_key}: {password_key} is empty")
            updates[url_key] = f"postgresql://{user}:{password}@postgres:5432/{database}"

    private = values.get("JWT_PRIVATE_KEY", "")
    if not private.strip():
        private = generate_private_pem()
        updates["JWT_PRIVATE_KEY"] = private
    public_pem, kid, current_jwk = jwk_from_private_pem(private if private.endswith("\n") else private + "\n")
    if values.get("JWT_KEY_ID", "").strip() != kid:
        updates["JWT_KEY_ID"] = kid
    if values.get("JWT_PUBLIC_KEY", "").strip() != public_pem.strip():
        updates["JWT_PUBLIC_KEY"] = public_pem

    keys = [current_jwk]
    previous_pem = values.get("JWT_PREVIOUS_PUBLIC_KEY", "").strip()
    previous_kid = values.get("JWT_PREVIOUS_KEY_ID", "").strip()
    if previous_pem:
        previous_jwk = jwk_from_public_pem(previous_pem, previous_kid)
        if previous_jwk["kid"] != kid:
            keys.append(previous_jwk)
        if not previous_kid:
            updates["JWT_PREVIOUS_KEY_ID"] = previous_jwk["kid"]
    elif previous_kid:
        print(
            "JWT_PREVIOUS_KEY_ID is set without JWT_PREVIOUS_PUBLIC_KEY. "
            "The previous key was not added to the JWKS.",
            file=sys.stderr,
        )

    document = {"keys": keys}
    jwks_text = json.dumps(document, separators=(",", ":"))
    if values.get("IDENTITY_JWKS", "").strip() != jwks_text:
        updates["IDENTITY_JWKS"] = jwks_text

    if updates:
        set_values(ENV_PATH, updates)
        print(f"updated {len(updates)} values in .env")
    else:
        print(".env already has secrets")

    SECRETS_DIR.mkdir(mode=0o700, exist_ok=True)
    JWKS_PATH.write_text(json.dumps(document, indent=2) + "\n", encoding="utf-8")
    os.chmod(JWKS_PATH, 0o644)
    extra = len(keys) - 1
    previous_note = f" previous={extra}" if extra else ""
    print(f"wrote {JWKS_PATH.name} (public keys only) kid={kid}{previous_note}")


def export_if_set(keys: list[str]) -> None:
    _lines, values = read_env(ENV_PATH)
    for key in keys:
        value = values.get(key, "")
        if value:
            print(f"export {key}={shlex.quote(value)}")


def set_from_stdin(key: str) -> None:
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
        sys.exit("invalid variable name")
    value = sys.stdin.read()
    if value.endswith("\n"):
        value = value[:-1]
    if not value.strip():
        sys.exit(f"refusing to set an empty {key}")
    if not ENV_PATH.exists():
        sys.exit(f"missing {ENV_PATH}")
    set_values(ENV_PATH, {key: value})
    print(f"updated {key}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--set", dest="set_key", help="set one variable from stdin")
    parser.add_argument(
        "--export-if-set",
        nargs="+",
        metavar="KEY",
        help="print shlex-quoted export lines for keys that already have values",
    )
    args = parser.parse_args()
    if args.set_key:
        set_from_stdin(args.set_key)
        return
    if args.export_if_set:
        export_if_set(args.export_if_set)
        return
    fill_secrets()


if __name__ == "__main__":
    main()
