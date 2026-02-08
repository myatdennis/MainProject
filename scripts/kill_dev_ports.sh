#!/usr/bin/env bash
set -euo pipefail

PORTS=(5174 8888)

for port in "${PORTS[@]}"; do
  if pids=$(lsof -ti tcp:"${port}" 2>/dev/null); then
    if [[ -n "${pids}" ]]; then
      echo "[dev-reset] Killing processes on port ${port}: ${pids}"
      # shellcheck disable=SC2086
      kill -9 ${pids}
      echo "[dev-reset] Port ${port} cleared."
    else
      echo "[dev-reset] No processes found on port ${port}."
    fi
  else
    echo "[dev-reset] No processes found on port ${port}."
  fi
done
