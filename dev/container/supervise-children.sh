#!/usr/bin/env bash
# Run background children, forward SIGTERM/SIGINT, exit when the first child exits.
set -euo pipefail

PIDS=()
STOP_SIGNAL=""

stop_children() {
  local pid
  for pid in "${PIDS[@]}"; do
    kill -TERM "${pid}" 2>/dev/null || true
  done
}

on_signal() {
  STOP_SIGNAL="$1"
  stop_children
}

start_child() {
  "$@" &
  PIDS+=("$!")
}

supervise_children() {
  trap 'on_signal SIGTERM' TERM
  trap 'on_signal SIGINT' INT

  local status=0
  set +e
  wait -n "${PIDS[@]}"
  status=$?
  if [ -z "${STOP_SIGNAL}" ]; then
    stop_children
  fi
  wait "${PIDS[@]}"
  set -e
  if [ -n "${STOP_SIGNAL}" ]; then
    exit 0
  fi
  if [ "${status}" -eq 0 ]; then
    status=1
  fi
  exit "${status}"
}
