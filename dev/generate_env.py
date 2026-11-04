#!/usr/bin/env python3
"""Generate dev/.env.local secrets from dev/.env.local.example.

If the output already exists, only variables it does not define yet are appended,
so existing secrets and database passwords are kept.
"""

from __future__ import annotations

import base64
import hashlib
import re
import secrets
import subprocess
import sys
from pathlib import Path


def secret_key() -> str:
    return secrets.token_urlsafe(64)


def fernet_key() -> str:
    return base64.urlsafe_b64encode(secrets.token_bytes(32)).decode()


def rsa_keypair(bits: int = 2048) -> tuple[str, str, str]:
    private_pem = subprocess.check_output(["openssl", "genrsa", str(bits)], text=True, stderr=subprocess.DEVNULL)
    public_pem = subprocess.check_output(
        ["openssl", "rsa", "-pubout"],
        input=private_pem,
        text=True,
    )
    pub_der = subprocess.check_output(
        ["openssl", "rsa", "-pubout", "-outform", "DER"],
        input=private_pem.encode(),
    )
    digest = hashlib.sha256(pub_der).digest()
    kid = base64.urlsafe_b64encode(digest[:16]).rstrip(b"=").decode("ascii")
    return private_pem, public_pem, kid


def pem_for_env(pem: str) -> str:
    return pem.strip().replace("\n", "\\n")


def esk_key() -> str:
    return "esk_" + secrets.token_urlsafe(32)


def var_name(line: str) -> str:
    match = re.match(r"([A-Z][A-Z0-9_]*)=", line)
    return match.group(1) if match else ""


def defined(text: str) -> set[str]:
    return {name for line in text.splitlines() if (name := var_name(line))}


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: generate_env.py <example> <output>", file=sys.stderr)
        return 2

    example_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])
    text = example_path.read_text(encoding="utf-8")

    jwt_private, jwt_public, jwt_kid = rsa_keypair()
    ai_private, _ai_public, ai_kid = rsa_keypair()

    replacements = {
        "__POSTGRES_PASSWORD__": secrets.token_urlsafe(24),
        "__IDENTITY_SECRET_KEY__": secret_key(),
        "__STORAGE_SECRET_KEY__": secret_key(),
        "__HOSTING_SECRET_KEY__": secret_key(),
        "__EMAIL_SECRET_KEY__": secret_key(),
        "__SAAS_SECRET_KEY__": secret_key(),
        "__AI_SECRET_KEY__": secret_key(),
        "__JWT_PRIVATE_KEY__": pem_for_env(jwt_private),
        "__JWT_PUBLIC_KEY__": pem_for_env(jwt_public),
        "__JWT_KEY_ID__": jwt_kid,
        "__AI_SERVICE_SIGNING_KEY__": pem_for_env(ai_private),
        "__AI_SERVICE_SIGNING_KID__": ai_kid,
        "__DASHBOARD_WEBHOOK_SECRET__": secrets.token_urlsafe(32),
        "__EMAIL_CREDENTIALS_KEY__": fernet_key(),
        "__EMAIL_VARIABLES_KEY__": fernet_key(),
        "__EMAIL_HASH_PEPPER__": secrets.token_urlsafe(32),
    }

    for marker, value in replacements.items():
        text = text.replace(marker, value)
    # One email-service key per caller, for example __ESK_STORAGE__.
    text = re.sub(r"__ESK_[A-Z]+__", lambda _match: esk_key(), text)

    if re.search(r"__[-A-Z0-9_]+__", text):
        print("Unresolved placeholders remain in output", file=sys.stderr)
        return 1

    if output_path.exists():
        current = output_path.read_text(encoding="utf-8")
        missing = [line for line in text.splitlines() if (name := var_name(line)) and name not in defined(current)]
        if missing:
            output_path.write_text(current.rstrip("\n") + "\n" + "\n".join(missing) + "\n", encoding="utf-8")
            print("Added " + ", ".join(var_name(line) for line in missing), file=sys.stderr)
        return 0

    output_path.write_text(text, encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
