#!/usr/bin/env bash
# Fill empty secrets in .env and write secrets/jwks.json. Prints no secret values.
set -euo pipefail
cd "$(dirname "$0")/.."
exec python3 scripts/generate-secrets.py "$@"
