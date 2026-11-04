#!/usr/bin/env bash
# Dev stack email-worker: same as email-service worker mode, with slower lane polling.
set -euo pipefail

POLL="${EMAIL_LANE_WORKER_POLL_SECONDS:-5}"
LANES=(auth transactional bulk)

log() {
  echo "email-worker-dev: $*" >&2
}

is_true() {
  case "$(printf '%s' "${1:-}" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')" in
    1 | true | yes | on) return 0 ;;
    *) return 1 ;;
  esac
}

is_set() {
  [ -n "$(printf '%s' "${1:-}" | tr -d '[:space:]')" ]
}

broker_configured() {
  is_set "${CELERY_BROKER_URL:-}" || is_set "${REDIS_URL:-}"
}

prepare_data_dir() {
  local sqlite_file sqlite_dir
  sqlite_file="${SQLITE_PATH:-/app/data/db.sqlite3}"
  sqlite_dir="$(dirname "${sqlite_file}")"
  mkdir -p "${sqlite_dir}"
}

SCHEDULER_ARGS=(
  celery -A config --quiet worker
  --beat
  --schedule "${CELERY_BEAT_SCHEDULE_FILE:-/tmp/celerybeat-schedule}"
  --pool threads
  --concurrency "${CELERY_WORKER_CONCURRENCY:-2}"
  --hostname "email-service@%h"
  --without-gossip
  --without-mingle
  --without-heartbeat
)

# shellcheck source=supervise-children.sh
. /opt/shellui/dev/container/supervise-children.sh

cd /app
prepare_data_dir

if is_true "${SCHEDULER_ENABLED:-true}" && broker_configured; then
  log "starting scheduler (Celery worker and beat)"
  start_child "${SCHEDULER_ARGS[@]}"
fi

if is_true "${EMAIL_WORKERS_ENABLED:-true}"; then
  for lane in "${LANES[@]}"; do
    log "starting the ${lane} lane worker (poll ${POLL}s)"
    start_child python manage.py run_email_worker --lane "${lane}" --poll-seconds "${POLL}"
  done
fi

if [ "${#PIDS[@]}" -eq 0 ]; then
  log "ERROR: nothing to run. Set REDIS_URL for the scheduler, or EMAIL_WORKERS_ENABLED=true."
  exit 1
fi

supervise_children
