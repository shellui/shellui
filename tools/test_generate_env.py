#!/usr/bin/env python3
"""Run generate-env self-checks and optional compose config validation."""

from __future__ import annotations

import json
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import Any


def parse_dotenv(path: Path) -> dict[str, str]:
    """Minimal KEY=value parser for generated .env (no multiline values)."""
    out: dict[str, str] = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if line.startswith("export "):
            line = line[7:].strip()
        if "=" not in line:
            continue
        key, val = line.split("=", 1)
        key = key.strip()
        val = val.strip()
        if (val.startswith('"') and val.endswith('"')) or (val.startswith("'") and val.endswith("'")):
            val = val[1:-1]
        out[key] = val
    return out


def service_env(doc: dict[str, Any], service: str) -> dict[str, str]:
    """Resolved environment block from `docker compose config --format json`."""
    services = doc.get("services") or {}
    svc = services.get(service) or {}
    block = svc.get("environment")
    if block is None:
        return {}
    if isinstance(block, dict):
        return {str(k): str(v) for k, v in block.items()}
    if isinstance(block, list):
        env: dict[str, str] = {}
        for item in block:
            if not isinstance(item, str) or "=" not in item:
                continue
            k, v = item.split("=", 1)
            env[k] = v
        return env
    return {}


def assert_identity_ai_saas_env(doc: dict[str, Any], dotenv: dict[str, str]) -> None:
    """Static checks on resolved compose env (issuer URL, internal hostname, JWT audiences)."""
    pid = dotenv["PUBLIC_IDENTITY_URL"]
    psaas = dotenv["PUBLIC_SAAS_URL"]
    pai = dotenv["PUBLIC_AI_URL"]
    ga_aud = dotenv["GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE"]
    internal_identity = "http://identity:8000"

    ident = service_env(doc, "identity")
    ai = service_env(doc, "ai")
    saas = service_env(doc, "saas")

    assert ident.get("JWT_ISSUER") == pid, "identity JWT_ISSUER must equal PUBLIC_IDENTITY_URL"
    assert ident.get("GLOBAL_ISSUER_URL") == psaas, "identity GLOBAL_ISSUER_URL must equal PUBLIC_SAAS_URL"
    assert ident.get("GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE") == ga_aud
    assert ident.get("AI_SERVICE_ISSUER") == pai, "identity AI_SERVICE_ISSUER must equal PUBLIC_AI_URL"
    assert ident.get("AI_SERVICE_JWKS_URL") == "http://ai:8000/.well-known/jwks.json"
    gjwk = ident.get("GLOBAL_JWKS", "")
    assert gjwk, "identity GLOBAL_JWKS must be set after generate_env"
    assert '"kid"' in gjwk or "'kid'" in gjwk, "GLOBAL_JWKS should contain kid"

    assert ai.get("IDENTITY_SERVICE_URL") == internal_identity
    assert ai.get("IDENTITY_JWKS_URL") == f"{internal_identity}/.well-known/jwks.json"
    assert ai.get("IDENTITY_ISSUER") == pid
    assert ai.get("AI_SERVICE_ISSUER") == pai

    assert saas.get("IDENTITY_INTERNAL_URL") == internal_identity
    assert saas.get("GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE") == ga_aud
    # In-network send URL. Identity discovery uses the public origin below.
    assert saas.get("EMAIL_SERVICE_URL") == "http://email:8000"

    internal_jwks = f"{internal_identity}/.well-known/jwks.json"
    public_email = dotenv["PUBLIC_EMAIL_URL"]
    for name in ("email", "email-worker"):
        env = service_env(doc, name)
        assert env.get("IDENTITY_SERVICE_URL") == internal_identity, name
        assert env.get("IDENTITY_JWKS_URL") == internal_jwks, name
        # MCP resource is EMAIL_PUBLIC_URL + /mcp. The identity-jwt anchor does not set it.
        assert env.get("EMAIL_PUBLIC_URL") == public_email, name
        joined = f"{env.get('IDENTITY_SERVICE_URL', '')} {env.get('IDENTITY_JWKS_URL', '')}"
        assert "localhost:8001" not in joined, name

    # Identity list_services publishes the public email origin when the key is set.
    assert ident.get("EMAIL_SERVICE_URL") == dotenv["PUBLIC_EMAIL_URL"]
    assert ident.get("EMAIL_SERVICE_INTERNAL_URL") == "http://email:8000"
    assert ident.get("EMAIL_SERVICE_API_KEY"), "identity EMAIL_SERVICE_API_KEY"


def main() -> int:
    root = Path(__file__).resolve().parents[1]
    dev = root / "dev"
    gen_test = dev / "generate_env.test.py"
    r = subprocess.run([sys.executable, str(gen_test)], cwd=str(dev), check=False)
    if r.returncode != 0:
        return r.returncode

    example = dev / ".env.local.example"
    compose = dev / "docker-compose.yml"
    if not example.is_file() or not compose.is_file():
        print("missing dev/.env.local.example or dev/docker-compose.yml", file=sys.stderr)
        return 1

    with tempfile.NamedTemporaryFile(mode="w+", suffix=".env", delete=False) as tmp:
        out = Path(tmp.name)
    try:
        r2 = subprocess.run(
            [sys.executable, str(dev / "generate_env.py"), str(example), str(out)],
            cwd=str(dev),
            check=True,
            capture_output=True,
            text=True,
        )
        assert "eyJ" not in (r2.stdout or "") and "eyJ" not in (r2.stderr or ""), "unexpected JWT in generator output"
        dotenv = parse_dotenv(out)

        compose_argv = [
            "docker",
            "compose",
            "-f",
            str(compose),
            "--env-file",
            str(out),
            "config",
            "--format",
            "json",
        ]
        try:
            cfg = subprocess.run(
                compose_argv,
                cwd=str(dev.parent),
                check=True,
                capture_output=True,
                text=True,
            )
        except FileNotFoundError:
            print("docker not available; skipped compose config validation")
            return 0
        except subprocess.CalledProcessError as exc:
            print(exc.stderr or exc.stdout or exc, file=sys.stderr)
            return exc.returncode

        try:
            doc = json.loads(cfg.stdout)
        except json.JSONDecodeError as exc:
            print("docker compose config --format json: invalid JSON", exc, file=sys.stderr)
            return 1

        try:
            assert_identity_ai_saas_env(doc, dotenv)
        except AssertionError as exc:
            print(f"compose env assertion failed: {exc}", file=sys.stderr)
            return 1

        print("docker compose config: ok (identity issuer, internal URLs, global audience)")
    finally:
        out.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
