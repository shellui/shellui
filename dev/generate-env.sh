#!/usr/bin/env bash
# Fill dev/.env.local from dev/.env.local.example with generated secrets and keys.
set -euo pipefail

DEV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE="${DEV_DIR}/.env.local.example"
TARGET="${DEV_DIR}/.env.local"

if [[ ! -f "${EXAMPLE}" ]]; then
  echo "Missing ${EXAMPLE}" >&2
  exit 1
fi

if [[ -f "${TARGET}" ]]; then
  echo "${TARGET} already exists. Remove it or edit in place." >&2
  exit 1
fi

run_generate_env() {
  if command -v uv >/dev/null 2>&1; then
    uv run --no-project python "$@"
  elif command -v python3 >/dev/null 2>&1; then
    python3 "$@"
  else
    cat >&2 <<'EOF'
generate-env.sh could not find a Python interpreter.

Install uv (https://docs.astral.sh/uv/) or Python 3, then re-run ./generate-env.sh.
The generator uses only the standard library plus OpenSSL on PATH for RSA keys.
EOF
    exit 1
  fi
}

run_generate_env "${DEV_DIR}/generate_env.py" "${EXAMPLE}" "${TARGET}"
echo "Wrote ${TARGET}"
