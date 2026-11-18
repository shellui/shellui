#!/bin/sh
# Prepends the dev python shim (slower StatReloader) then execs the service entrypoint.
set -eu

export PATH="/opt/shellui/dev/container/bin:${PATH}"
export DJANGO_STATRELOAD_SLEEP="${DJANGO_STATRELOAD_SLEEP:-3}"

if [ "$#" -lt 1 ]; then
  echo "django-dev-path: missing service entrypoint" >&2
  exit 1
fi

entrypoint="$1"
shift
exec "${entrypoint}" "$@"
