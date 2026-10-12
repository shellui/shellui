#!/usr/bin/env bash
# Check health endpoints, that identity publishes the pinned JWKS, and that the identity key is accepted.
set -euo pipefail

cd "$(dirname "$0")/.."

set -a
# shellcheck disable=SC1091
. ./.env
set +a

compose() {
  docker compose --env-file .env -f docker-compose.yml "$@"
}

check() {
  local name="$1"
  local url="$2"
  local kind="$3"
  local body
  body="$(curl -fsS "$url")"
  echo "${name} health ok"
  if [ "$kind" = "text" ]; then
    printf '%s' "$body" | grep -qx 'ok'
    return
  fi
  printf '%s' "$body" | python3 -c 'import json,sys; json.load(sys.stdin)' >/dev/null
}

# identity /health/live is text/plain "ok". The other health routes return JSON.
check identity "http://127.0.0.1:${IDENTITY_PUBLISH_PORT:-8000}/health/live" text
check storage "http://127.0.0.1:${STORAGE_PUBLISH_PORT:-8001}/storage/v1/health" json
check hosting "http://127.0.0.1:${HOSTING_PUBLISH_PORT:-8002}/hosting/v1/health" json
check email "http://127.0.0.1:${EMAIL_PUBLISH_PORT:-8003}/api/v1/health" json

python3 - <<'PY'
import json
import os
import urllib.request

port = os.environ.get("IDENTITY_PUBLISH_PORT", "8000")
with urllib.request.urlopen(f"http://127.0.0.1:{port}/.well-known/jwks.json", timeout=10) as response:
    live = json.load(response)
pinned = json.load(open("secrets/jwks.json", encoding="utf-8"))
live_kids = {key.get("kid") for key in live.get("keys", [])}
pinned_kids = {key.get("kid") for key in pinned.get("keys", [])}
if not pinned_kids or not pinned_kids <= live_kids:
    raise SystemExit(f"JWKS mismatch live={sorted(live_kids)} pinned={sorted(pinned_kids)}")
print("identity JWKS matches the pinned document")
PY

compose exec -T identity python - <<'PY'
import os
import urllib.error
import urllib.request

key = os.environ.get("EMAIL_SERVICE_API_KEY", "").strip()
if not key.startswith("esk_"):
    raise SystemExit("identity has no email-service key. Run ./scripts/bootstrap.sh")
request = urllib.request.Request(
    "http://email:8000/api/v1/catalog",
    headers={"Authorization": "Bearer " + key},
)
try:
    with urllib.request.urlopen(request, timeout=15) as response:
        status = response.status
except urllib.error.HTTPError as exc:
    raise SystemExit(f"email-service catalog returned {exc.code}") from None
if status != 200:
    raise SystemExit(f"email-service catalog returned {status}")
print("email-service accepted the identity service key")
PY

echo "stack checks passed"
