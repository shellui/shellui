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


def published_ports(service: dict[str, Any]) -> set[str]:
    found: set[str] = set()
    for port in service.get("ports") or []:
        if isinstance(port, dict):
            published = port.get("published")
            if published is not None:
                found.add(str(published))
        elif isinstance(port, str) and ":" in port:
            found.add(port.rsplit(":", 1)[0].split(":")[-1])
    return found


def assert_otel_env(doc: dict[str, Any], dotenv: dict[str, str]) -> None:
    """Resolved OTLP env for each Django process, and the Jaeger UI port."""
    endpoint = "http://jaeger:4318"
    protocol = "http/protobuf"
    region = dotenv["DEV_REGION_CODE"]
    attributes = f"deployment.environment=dev,cloud.region={region}"
    assert dotenv["OTEL_EXPORTER_OTLP_ENDPOINT"] == endpoint
    assert dotenv["OTEL_EXPORTER_OTLP_PROTOCOL"] == protocol
    assert "${" not in attributes

    expected = {
        "identity": "shellui-identity",
        "identity-global": "shellui-identity-global",
        "email": "shellui-email",
        "email-worker": "shellui-email-worker",
        "storage": "shellui-storage",
        "hosting": "shellui-hosting",
        "saas": "shellui-saas",
        "ai": "shellui-ai",
        "ai-global": "shellui-ai-global",
    }
    for service, service_name in expected.items():
        env = service_env(doc, service)
        assert env.get("OTEL_SERVICE_NAME") == service_name, service
        assert env.get("OTEL_EXPORTER_OTLP_ENDPOINT") == endpoint, service
        assert env.get("OTEL_EXPORTER_OTLP_PROTOCOL") == protocol, service
        assert env.get("OTEL_RESOURCE_ATTRIBUTES") == attributes, service

    for name in ("shell", "admin", "dashboard", "files", "playground"):
        assert "OTEL_SERVICE_NAME" not in service_env(doc, name), name

    services = doc.get("services") or {}
    jaeger = services.get("jaeger") or {}
    assert jaeger.get("image") == "jaegertracing/jaeger:2.23.0"
    assert "16686" in published_ports(jaeger)
    jaeger_env = jaeger.get("environment")
    if isinstance(jaeger_env, dict):
        assert str(jaeger_env.get("JAEGER_LISTEN_HOST")) == "0.0.0.0"
    elif isinstance(jaeger_env, list):
        assert "JAEGER_LISTEN_HOST=0.0.0.0" in jaeger_env
    else:
        raise AssertionError("jaeger environment missing")


def assert_identity_ai_saas_env(doc: dict[str, Any], dotenv: dict[str, str]) -> None:
    """Static checks on resolved compose env (issuer URL, internal hostname, JWT audiences)."""
    host = dotenv.get("DEV_PUBLIC_HOST", "localhost")

    def expand(value: str) -> str:
        return value.replace("${DEV_PUBLIC_HOST}", host)

    pid = expand(dotenv["PUBLIC_IDENTITY_URL"])
    pglobal = expand(dotenv["PUBLIC_IDENTITY_GLOBAL_URL"])
    psaas = expand(dotenv["PUBLIC_SAAS_URL"])
    pai = expand(dotenv["PUBLIC_AI_URL"])
    pai_global = expand(dotenv["PUBLIC_AI_GLOBAL_URL"])
    ga_aud = dotenv["GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE"]
    global_aud = dotenv["IDENTITY_GLOBAL_JWT_AUDIENCE"]
    internal_identity = "http://identity:8000"
    internal_global = "http://identity-global:8000"

    ident = service_env(doc, "identity")
    global_ident = service_env(doc, "identity-global")
    ai = service_env(doc, "ai")
    ai_global = service_env(doc, "ai-global")
    saas = service_env(doc, "saas")
    dashboard = service_env(doc, "dashboard")
    shell = service_env(doc, "shell")

    assert ident.get("SHELLUI_INSTANCE_ROLE") == "region"
    assert ident.get("JWT_ISSUER") == pid, "identity JWT_ISSUER must equal PUBLIC_IDENTITY_URL"
    assert ident.get("GLOBAL_ISSUER_URL") == pglobal, "identity GLOBAL_ISSUER_URL must equal PUBLIC_IDENTITY_GLOBAL_URL"
    assert ident.get("GLOBAL_ISSUER_INTERNAL_URL") == internal_global
    assert ident.get("GLOBAL_ACCESS_TOKEN_AUDIENCE") == global_aud
    assert ident.get("GLOBAL_AGENT_ISSUER_URL") == pai_global
    assert ident.get("GLOBAL_AGENT_LEGACY_ISSUER_URL") == psaas
    assert ident.get("GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE") == ga_aud
    assert ident.get("GLOBAL_MCP_URL") == f"{pai_global}/mcp"
    assert ident.get("GLOBAL_CLIENT_ID"), "regional identity needs GLOBAL_CLIENT_ID"
    assert ident.get("GLOBAL_CLIENT_SECRET"), "regional identity needs GLOBAL_CLIENT_SECRET"
    assert ident.get("AI_SERVICE_ISSUER") == pai, "identity AI_SERVICE_ISSUER must equal PUBLIC_AI_URL"
    assert ident.get("AI_SERVICE_JWKS_URL") == "http://ai:8000/.well-known/jwks.json"
    gjwk = ident.get("GLOBAL_JWKS", "")
    agent_jwks = ident.get("GLOBAL_AGENT_JWKS", "")
    legacy_agent_jwks = ident.get("GLOBAL_AGENT_LEGACY_JWKS", "")
    assert gjwk, "identity GLOBAL_JWKS must be set after generate_env"
    assert '"kid"' in gjwk or "'kid'" in gjwk, "GLOBAL_JWKS should contain kid"
    assert agent_jwks and agent_jwks != gjwk, "ai-global JWKS must be set and differ from the user JWKS"
    assert legacy_agent_jwks and legacy_agent_jwks != agent_jwks, "legacy saas JWKS must differ from ai-global"
    assert legacy_agent_jwks != gjwk
    assert agent_jwks == dotenv["AI_GLOBAL_JWKS"]
    assert legacy_agent_jwks == dotenv["GLOBAL_AGENT_JWKS"]
    assert ident.get("JWT_KEY_ID") != global_ident.get("JWT_KEY_ID"), "regional and global signing kids must differ"

    assert global_ident.get("SHELLUI_INSTANCE_ROLE") == "global"
    assert global_ident.get("JWT_ISSUER") == pglobal
    assert global_ident.get("JWT_AUDIENCE") == global_aud
    assert global_ident.get("JWT_KEY_ID"), "identity-global JWT_KEY_ID"
    assert global_ident.get("SECRET_KEY") != ident.get("SECRET_KEY")
    assert "identity_global" in global_ident.get("POSTGRES_DATABASE_URL", "")
    assert global_ident.get("REDIS_URL", "").endswith("/6")
    assert "GLOBAL_MCP_URL" not in global_ident
    assert global_ident.get("OIDC_CLIENTS"), "identity-global OIDC_CLIENTS"
    assert ident.get("GLOBAL_CLIENT_ID") in global_ident.get("OIDC_CLIENTS", "")
    assert dotenv["GLOBAL_OIDC_CLIENT_ID"] in global_ident.get("OIDC_CLIENTS", "")
    assert "8008/oauth/mcp/signin/complete" in global_ident.get("OIDC_CLIENTS", "")

    assert ai.get("AI_SERVICE_MODE") == "region"
    assert ai.get("IDENTITY_SERVICE_URL") == internal_identity
    assert ai.get("IDENTITY_JWKS_URL") == f"{internal_identity}/.well-known/jwks.json"
    assert ai.get("IDENTITY_ISSUER") == pid
    assert ai.get("AI_SERVICE_ISSUER") == pai
    assert "SAAS_SERVICE_URL" not in ai
    assert "SAAS_SERVICE_PUBLIC_URL" not in ai
    for name in (
        "GLOBAL_IDENTITY_URL",
        "GLOBAL_OIDC_CLIENT_ID",
        "GLOBAL_OIDC_CLIENT_SECRET",
        "SAAS_API_AUDIENCE",
    ):
        assert name not in ai, name

    assert ai_global.get("AI_SERVICE_MODE") == "global"
    assert ai_global.get("AI_PUBLIC_URL") == pai_global
    assert ai_global.get("AI_SERVICE_ISSUER") == pai_global
    assert ai_global.get("SECRET_KEY") != ai.get("SECRET_KEY")
    assert "ai_global" in ai_global.get("POSTGRES_DATABASE_URL", "")
    assert ai_global.get("REDIS_URL", "").endswith("/7")
    assert ai_global.get("GLOBAL_IDENTITY_URL") == pglobal
    assert ai_global.get("GLOBAL_IDENTITY_INTERNAL_URL") == internal_global
    assert ai_global.get("GLOBAL_IDENTITY_ISSUER") == pglobal
    assert ai_global.get("GLOBAL_IDENTITY_JWKS") == gjwk
    assert ai_global.get("GLOBAL_OIDC_CLIENT_ID") == dotenv["GLOBAL_OIDC_CLIENT_ID"]
    assert ai_global.get("GLOBAL_OIDC_CLIENT_SECRET") == dotenv["GLOBAL_OIDC_CLIENT_SECRET"]
    assert ai_global.get("GLOBAL_OIDC_REDIRECT_URI") == f"{pai_global}/oauth/mcp/signin/complete"
    assert ai_global.get("SAAS_SERVICE_URL") == psaas
    assert ai_global.get("SAAS_SERVICE_INTERNAL_URL") == "http://saas:8000"
    assert ai_global.get("SAAS_API_AUDIENCE") == f"{psaas}/api"
    assert ai_global.get("GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE") == ga_aud
    assert ai_global.get("AI_SERVICE_SIGNING_KID") == dotenv["AI_GLOBAL_SERVICE_SIGNING_KID"]
    assert ai_global.get("AI_SERVICE_SIGNING_KID") != ai.get("AI_SERVICE_SIGNING_KID")
    assert "IDENTITY_SERVICE_URL" not in ai_global
    assert "IDENTITY_JWKS" not in ai_global
    for name in (
        "IDENTITY_JWKS_FILE",
        "IDENTITY_JWKS_URL",
        "IDENTITY_ISSUER",
        "IDENTITY_AUDIENCE",
        "STORAGE_SERVICE_URL",
        "HOSTING_SERVICE_URL",
        "EMAIL_SERVICE_API_KEY",
    ):
        assert not ai_global.get(name), name

    assert saas.get("IDENTITY_INTERNAL_URL") == internal_global
    assert saas.get("IDENTITY_SERVICE_URL") == internal_global
    assert saas.get("IDENTITY_ISSUER") == pglobal
    assert saas.get("IDENTITY_AUDIENCE") == global_aud
    assert saas.get("GLOBAL_ISSUER_URL") == psaas
    assert "GLOBAL_AGENT_ISSUER" not in saas
    assert saas.get("GLOBAL_AGENT_ACCESS_TOKEN_AUDIENCE") == ga_aud
    assert saas.get("GLOBAL_AGENT_KEY_ID") != global_ident.get("JWT_KEY_ID")
    assert saas.get("AI_GLOBAL_ISSUER") == pai_global
    assert saas.get("AI_GLOBAL_JWKS") == dotenv["AI_GLOBAL_JWKS"]
    assert saas.get("REGION_CH_AI_URL") == pai
    assert shell.get("PUBLIC_IDENTITY_URL") == pid
    assert dashboard.get("IDENTITY_SERVICE_URL") == pglobal
    # In-network send URL. Identity discovery uses the public origin below.
    assert saas.get("EMAIL_SERVICE_URL") == "http://email:8000"

    internal_jwks = f"{internal_identity}/.well-known/jwks.json"
    public_email = expand(dotenv["PUBLIC_EMAIL_URL"])
    for name in ("email", "email-worker"):
        env = service_env(doc, name)
        assert env.get("IDENTITY_SERVICE_URL") == internal_identity, name
        assert env.get("IDENTITY_JWKS_URL") == internal_jwks, name
        # MCP resource is EMAIL_PUBLIC_URL + /mcp. The identity-jwt anchor does not set it.
        assert env.get("EMAIL_PUBLIC_URL") == public_email, name
        joined = f"{env.get('IDENTITY_SERVICE_URL', '')} {env.get('IDENTITY_JWKS_URL', '')}"
        assert "localhost:8001" not in joined, name

    assert_otel_env(doc, dotenv)

    # Identity list_services publishes the public email origin when the key is set.
    assert ident.get("EMAIL_SERVICE_URL") == public_email
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

        print("docker compose config: ok (two identities, two ai modes, internal URLs)")
    finally:
        out.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
