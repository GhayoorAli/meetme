#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Starting Docker stack (MySQL, LiveKit, phpMyAdmin)..."
cd "$ROOT"
docker compose up -d

echo "==> Service status:"
docker compose ps

echo ""
echo "MeetMe dev stack:"
echo "  MySQL    : 127.0.0.1:3307  (meet_db / root / root)"
echo "  phpMyAdmin: http://localhost:8080"
echo "  LiveKit  : ws://localhost:7880"
echo "  Laravel  : cd backend && php artisan migrate && php artisan serve"
echo "  Next.js  : cd frontend && pnpm dev"
echo ""
echo "Open http://localhost:3000"
