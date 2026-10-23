#!/usr/bin/env bash
# Start the stack, issue email-service keys once, and optionally create the first superuser.
# Key material is written to .env and is not printed.
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ ! -f .env || ! -f secrets/jwks.json ]]; then
  echo "Run ./scripts/generate-secrets.sh first." >&2
  exit 1
fi

compose() {
  docker compose --env-file .env -f docker-compose.yml "$@"
}

env_value() {
  python3 -c '
import importlib.util
import sys
from pathlib import Path

spec = importlib.util.spec_from_file_location("generate_secrets", "scripts/generate-secrets.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
_lines, values = mod.read_env(Path(".env"))
print(values.get(sys.argv[1], ""), end="")
' "$1"
}

issue_key() {
  local env_name="$1"
  local service="$2"
  local lanes="$3"
  local prefixes="$4"
  local current
  current="$(env_value "$env_name")"
  if [[ -n "$current" ]]; then
    echo "${env_name} is already set"
    return 0
  fi
  local out err
  out="$(mktemp)"
  err="$(mktemp)"
  chmod 600 "$out" "$err"
  if ! compose exec -T email python manage.py create_service_key \
    --service "$service" \
    --lanes "$lanes" \
    --prefixes "$prefixes" >"$out" 2>"$err"; then
    cat "$err" >&2
    rm -f "$out" "$err"
    exit 1
  fi
  local key
  key="$(tail -n 1 "$out")"
  rm -f "$out" "$err"
  if [[ "$key" != esk_* ]]; then
    echo "email-service did not return an esk_ key for ${service}" >&2
    exit 1
  fi
  printf '%s' "$key" | python3 scripts/generate-secrets.py --set "$env_name" >/dev/null
  echo "issued an email-service key for ${service}"
}

echo "starting the stack"
compose up -d --wait

issue_key EMAIL_SERVICE_API_KEY_IDENTITY identity auth,transactional identity.
issue_key EMAIL_SERVICE_API_KEY_STORAGE storage transactional storage.
issue_key EMAIL_SERVICE_API_KEY_HOSTING hosting transactional hosting.

echo "reloading callers that received a new key"
compose up -d --no-deps --force-recreate \
  identity identity-worker storage storage-worker hosting hosting-worker
compose up -d --wait

username="$(env_value SHELLUI_SUPERUSER_USERNAME)"
email="$(env_value SHELLUI_SUPERUSER_EMAIL)"
password="$(env_value SHELLUI_SUPERUSER_PASSWORD)"
if [[ -n "$username" && -n "$email" && -n "$password" ]]; then
  super_out="$(mktemp)"
  chmod 600 "$super_out"
  set +e
  compose exec -T \
    -e DJANGO_SUPERUSER_USERNAME="$username" \
    -e DJANGO_SUPERUSER_EMAIL="$email" \
    -e DJANGO_SUPERUSER_PASSWORD="$password" \
    identity python manage.py createsuperuser --noinput >"$super_out" 2>&1
  status=$?
  set -e
  if [[ "$status" -ne 0 ]] && ! grep -q "already taken" "$super_out"; then
    # Drop lines that might echo a password. createsuperuser does not, but keep this narrow.
    grep -v -i "password" "$super_out" >&2 || true
    rm -f "$super_out"
    unset password
    exit 1
  fi
  rm -f "$super_out"
  unset password
  echo "superuser step finished for ${username}"
else
  unset password
  echo "Create the first superuser with:"
  echo "  docker compose exec identity python manage.py createsuperuser"
fi

identity_port="$(env_value IDENTITY_PUBLISH_PORT)"
storage_port="$(env_value STORAGE_PUBLISH_PORT)"
hosting_port="$(env_value HOSTING_PUBLISH_PORT)"
email_port="$(env_value EMAIL_PUBLISH_PORT)"
echo "Identity Django admin: http://identity.localhost:${identity_port:-8000}/admin/"
echo "Storage Django admin: http://storage.localhost:${storage_port:-8001}/admin/"
echo "Hosting Django admin: http://hosting.localhost:${hosting_port:-8002}/admin/"
echo "Email Django admin: http://email.localhost:${email_port:-8003}/admin/"
