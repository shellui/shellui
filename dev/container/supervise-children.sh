#!/usr/bin/env bash
# Run background children, forward SIGTERM/SIGINT, exit when the first child exits.
set -euo pipefail

PIDS=()
STOP_SIGNAL=""
SUPERVISE_STOP_TIMEOUT="${SUPERVISE_STOP_TIMEOUT:-15}"

stop_children() {
  local pid
  for pid in "${PIDS[@]}"; do
    kill -TERM "${pid}" 2>/dev/null || true
  done
}

kill_children() {
  local pid
  for pid in "${PIDS[@]}"; do
    kill -KILL "${pid}" 2>/dev/null || true
  done
}

wait_for_children() {
  local deadline=$((SECONDS + SUPERVISE_STOP_TIMEOUT))
  local pid
  while [ "${SECONDS}" -lt "${deadline}" ]; do
    local running=0
    for pid in "${PIDS[@]}"; do
      if kill -0 "${pid}" 2>/dev/null; then
        running=1
        break
      fi
    done
    if [ "${running}" -eq 0 ]; then
      return 0
    fi
    sleep 0.2
  done
  kill_children
}

on_signal() {
  STOP_SIGNAL="${1:-signal}"
  stop_children
  wait_for_children
}

start_child() {
  "$@" &
  PIDS+=("$!")
}

supervise_init_traps() {
  trap 'on_signal SIGTERM' TERM
  trap 'on_signal SIGINT' INT
}

supervise_children() {
  supervise_init_traps

  local status=0
  set +e
  wait -n "${PIDS[@]}"
  status=$?
  if [ -z "${STOP_SIGNAL}" ]; then
    stop_children
    wait_for_children
  fi
  wait "${PIDS[@]}" 2>/dev/null || true
  set -e
  if [ -n "${STOP_SIGNAL}" ]; then
    exit 0
  fi
  if [ "${status}" -eq 0 ]; then
    status=1
  fi
  exit "${status}"
}
