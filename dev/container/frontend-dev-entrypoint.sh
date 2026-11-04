#!/bin/sh
# Dev stack: install deps when needed, link @shellui/* from the monorepo, then run Vite.
set -eu

APP_DIR="${APP_DIR:-/app}"
SHELLUI_ROOT="${SHELLUI_ROOT:-/opt/shellui}"
cd "${APP_DIR}"

export COREPACK_ENABLE_DOWNLOAD_PROMPT="${COREPACK_ENABLE_DOWNLOAD_PROMPT:-0}"
if command -v corepack >/dev/null 2>&1; then
  corepack enable >/dev/null 2>&1 || true
fi

if [ ! -d node_modules/.pnpm ]; then
  pnpm install --frozen-lockfile
fi

if [ -d "${SHELLUI_ROOT}/packages" ]; then
  node "${SHELLUI_ROOT}/dev/container/link-local-shellui-packages.mjs" "${APP_DIR}" "${SHELLUI_ROOT}"
fi

if [ $# -eq 0 ]; then
  set -- node "${SHELLUI_ROOT}/dev/container/run-vite-dev.mjs"
fi

exec "$@"
