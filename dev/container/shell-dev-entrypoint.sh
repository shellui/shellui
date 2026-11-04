#!/bin/sh
# Dev stack: keep workspace node_modules in sync with the bind-mounted monorepo.
set -eu

cd /app

export COREPACK_ENABLE_DOWNLOAD_PROMPT="${COREPACK_ENABLE_DOWNLOAD_PROMPT:-0}"

LOCK="${PWD}/pnpm-lock.yaml"
STAMP="${PWD}/node_modules/.shellui-dev-lock-stamp"

if [ ! -d node_modules/.pnpm ] || [ ! -f "${STAMP}" ] || [ "${LOCK}" -nt "${STAMP}" ]; then
  pnpm install --frozen-lockfile
  touch "${STAMP}"
fi

exec node packages/cli/bin/shellui.js start --host --config dev/config
