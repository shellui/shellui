#!/usr/bin/env bash
set -euo pipefail

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${DEV_DIR}"

# Creates .env.local, or appends variables added to .env.local.example since.
./generate-env.sh

# A completed one-shot container stays stopped, and Compose will not run it again.
# Remove postgres-init so every start creates databases that are still missing.
docker compose --env-file .env.local -f docker-compose.yml rm -f -s postgres-init

exec docker compose --env-file .env.local -f docker-compose.yml up --build "$@"
