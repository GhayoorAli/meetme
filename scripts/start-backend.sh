#!/usr/bin/env bash
set -euo pipefail

echo "Stopping old Laravel servers..."
pkill -f "artisan serve" 2>/dev/null || true

if command -v fuser >/dev/null 2>&1; then
  fuser -k 8000/tcp 2>/dev/null || true
  fuser -k 8001/tcp 2>/dev/null || true
fi

sleep 2

if command -v ss >/dev/null 2>&1; then
  if ss -tln | grep -q ':8000 '; then
    echo "ERROR: Port 8000 is still in use. Run this manually:"
    echo "  fuser -k 8000/tcp"
    echo "  pkill -f 'artisan serve'"
    exit 1
  fi
fi

cd "$(dirname "$0")/../backend"
echo "Starting Laravel on http://localhost:8000 ..."
echo "(Use http://localhost:3000 in your browser — not 127.0.0.1)"
php artisan serve --host=localhost --port=8000
