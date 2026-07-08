#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ -x "$ROOT_DIR/.venv/bin/python" ]; then
  PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
elif command -v python3.10 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3.10)"
elif command -v python3.11 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3.11)"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="$(command -v python3)"
else
  echo "No compatible Python interpreter was found." >&2
  exit 1
fi

if [ ! -d "$ROOT_DIR/.venv" ]; then
  echo "Creating virtual environment with $PYTHON_BIN"
  "$PYTHON_BIN" -m venv "$ROOT_DIR/.venv"
fi

source "$ROOT_DIR/.venv/bin/activate"
python --version
python -m pip install --upgrade pip
python -m pip install -r "$ROOT_DIR/backend/requirements.txt"

echo "Backend environment is ready."
