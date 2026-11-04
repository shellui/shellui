#!/usr/bin/env bash
# Fill .env.local from .env.local.example with generated secrets and keys.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE="${ROOT}/.env.local.example"
TARGET="${ROOT}/.env.local"

if [[ ! -f "${EXAMPLE}" ]]; then
  echo "Missing ${EXAMPLE}" >&2
  exit 1
fi

if [[ -f "${TARGET}" ]]; then
  echo "${TARGET} already exists. Remove it or edit in place." >&2
  exit 1
fi

python3 "${ROOT}/dev/generate_env.py" "${EXAMPLE}" "${TARGET}"
echo "Wrote ${TARGET}"
