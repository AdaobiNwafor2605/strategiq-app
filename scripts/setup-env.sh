#!/usr/bin/env bash
# Create local env files for strategiq-app from templates.
# Values come from your Supabase project dashboard — not from any other repo folder.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

copy_if_missing() {
  local example="$1"
  local target="$2"
  if [ -f "$target" ]; then
    echo "  keep  $target"
  else
    cp "$example" "$target"
    echo "  create $target (from $(basename "$example"))"
  fi
}

echo "Setting up environment files in strategiq-app..."
copy_if_missing "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
copy_if_missing "$ROOT_DIR/backend/.env.example" "$ROOT_DIR/backend/.env"

missing=0
check_var() {
  local file="$1"
  local key="$2"
  if ! grep -q "^${key}=." "$file" 2>/dev/null; then
    echo "  missing or empty: $key in $file"
    missing=1
  fi
}

echo ""
echo "Checking required variables..."
check_var "$ROOT_DIR/.env" "VITE_SUPABASE_URL"
check_var "$ROOT_DIR/.env" "VITE_SUPABASE_ANON_KEY"
check_var "$ROOT_DIR/backend/.env" "SUPABASE_URL"
check_var "$ROOT_DIR/backend/.env" "SUPABASE_JWT_SECRET"
check_var "$ROOT_DIR/backend/.env" "SUPABASE_SERVICE_ROLE_KEY"

if [ "$missing" -eq 1 ]; then
  echo ""
  echo "Fill in the empty values from Supabase Dashboard:"
  echo "  Project Settings → API"
  echo "    - Project URL        → VITE_SUPABASE_URL and SUPABASE_URL (same URL)"
  echo "    - anon public key    → VITE_SUPABASE_ANON_KEY"
  echo "    - JWT Secret         → SUPABASE_JWT_SECRET"
  echo "    - service_role key   → SUPABASE_SERVICE_ROLE_KEY"
  echo ""
  echo "Files to edit:"
  echo "  $ROOT_DIR/.env"
  echo "  $ROOT_DIR/backend/.env"
  exit 1
fi

echo ""
echo "Environment files look complete for strategiq-app."
