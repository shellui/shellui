#!/usr/bin/env bash
set -euo pipefail

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${DEV_DIR}"

if [[ ! -f .env.local ]]; then
  ./generate-env.sh
fi

exec docker compose --env-file .env.local -f docker-compose.yml up --build "$@"
