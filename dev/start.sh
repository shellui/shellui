#!/usr/bin/env bash
set -euo pipefail

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${DEV_DIR}"

# Creates .env.local, or appends variables added to .env.local.example since.
./generate-env.sh

exec docker compose --env-file .env.local -f docker-compose.yml up --build "$@"
