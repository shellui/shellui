#!/usr/bin/env python3
"""Check the Coolify template without running docker compose on it.

The template uses Coolify's bind-mount `content` key, which `docker compose config` rejects.
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.exit("PyYAML is required: python3 -m pip install pyyaml")

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / "coolify" / "docker-compose.yml"
data = yaml.safe_load(path.read_text(encoding="utf-8"))
services = data.get("services") or {}

required = [
    "postgres",
    "redis",
    "identity",
    "identity-worker",
    "storage",
    "storage-worker",
    "hosting",
    "hosting-worker",
    "email",
    "email-worker",
]
missing = [name for name in required if name not in services]
if missing:
    sys.exit(f"missing services: {', '.join(missing)}")

public = {"identity", "storage", "hosting", "email"}
for name, service in services.items():
    if "ports" in service or "container_name" in service or "restart" in service:
        sys.exit(f"{name} must not set ports, container_name, or restart")
    env = service.get("environment") or []
    if not isinstance(env, list):
        sys.exit(f"{name} environment must be a list so Coolify magic vars can be declared")
    declared = [
        item
        for item in env
        if isinstance(item, str)
        and "=" not in item
        and (item.startswith("SERVICE_URL_") or item.startswith("SERVICE_FQDN_"))
    ]
    if name in public:
        if f"SERVICE_URL_{name.upper()}_8000" not in declared:
            sys.exit(f"{name} is missing SERVICE_URL_{name.upper()}_8000")
    elif declared:
        sys.exit(f"{name} must not publish a Coolify domain")

postgres_mounts = services["postgres"].get("volumes") or []
contents = [
    item.get("content", "")
    for item in postgres_mounts
    if isinstance(item, dict) and item.get("content")
]
if not any("CREATE DATABASE identity" in text for text in contents):
    sys.exit("postgres init script content is missing")

text = path.read_text(encoding="utf-8")
for needle in (
    "shellui/identity-service:0.7.0",
    "shellui/storage-service:0.5.0",
    "shellui/hosting-service:0.6.1",
    "shellui/email-service:0.2.0",
    "postgres:16.15-alpine",
    "redis:8.2-alpine",
    "SERVICE_PASSWORD_64_POSTGRES",
    "SERVICE_REALBASE64_32_EMAILCREDENTIALS",
    "SERVICE_REALBASE64_32_EMAILVARIABLES",
    "SERVICE_PASSWORD_64_EMAILPEPPER",
    "JWT_PRIVATE_KEY:?",
    "IDENTITY_JWKS:?",
    "EMAIL_FALLBACK_PROVIDER:-none",
    "DEBUG:-false",
    "SCHEDULER_ENABLED=false",
    "SCHEDULER_ENABLED=true",
    "ACTIONS_WEBHOOK_ALLOW_PRIVATE=${IDENTITY_ACTIONS_WEBHOOK_ALLOW_PRIVATE:-false}",
    "ACTIONS_WEBHOOK_ALLOW_PRIVATE=${STORAGE_ACTIONS_WEBHOOK_ALLOW_PRIVATE:-false}",
    "ACTIONS_WEBHOOK_ALLOW_PRIVATE=${HOSTING_ACTIONS_WEBHOOK_ALLOW_PRIVATE:-false}",
    "ACTIONS_WEBHOOK_ALLOW_PRIVATE=${EMAIL_ACTIONS_WEBHOOK_ALLOW_PRIVATE:-false}",
    "RESEND_API_KEY=${RESEND_API_KEY:-}",
    "EMAIL_HOST=${EMAIL_HOST:-}",
    "EMAIL_PORT=${EMAIL_PORT:-}",
    "TRUSTED_PROXY_IPS=${TRUSTED_PROXY_IPS:-172.16.0.0/12}",
    "printenv IDENTITY_DB_PASSWORD",
    "${SERVICE_URL_IDENTITY}",
    "${SERVICE_FQDN_IDENTITY}",
):
    if needle not in text:
        sys.exit(f"template is missing {needle}")

for bad in (
    "IDENTITY_ACTIONS_WEBHOOK_ALLOW_PRIVATE=${",
    "STORAGE_ACTIONS_WEBHOOK_ALLOW_PRIVATE=${",
    "HOSTING_ACTIONS_WEBHOOK_ALLOW_PRIVATE=${",
    "EMAIL_ACTIONS_WEBHOOK_ALLOW_PRIVATE=${",
    "${IDENTITY_DB_PASSWORD}",
    "${SERVICE_URL_IDENTITY_8000}",
    "${SERVICE_FQDN_IDENTITY_8000}",
    "${SERVICE_URL_STORAGE_8000}",
    "${SERVICE_FQDN_STORAGE_8000}",
    "${SERVICE_URL_HOSTING_8000}",
    "${SERVICE_FQDN_HOSTING_8000}",
    "${SERVICE_URL_EMAIL_8000}",
    "${SERVICE_FQDN_EMAIL_8000}",
):
    if bad in text:
        sys.exit(f"template still has {bad}")

print("coolify template ok")
