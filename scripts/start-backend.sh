#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -x "$ROOT_DIR/.venv/bin/python" ]; then
  echo "Virtual environment not found. Run scripts/setup-backend.sh first." >&2
  exit 1
fi

source "$ROOT_DIR/.venv/bin/activate"
cd "$ROOT_DIR/backend"
exec python -m uvicorn main:app --reload --port 8000
