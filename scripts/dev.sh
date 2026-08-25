#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Starting LiveKit (Docker)..."
cd "$ROOT"
docker compose up -d

echo "==> LiveKit status:"
docker compose ps

echo ""
echo "MeetMe dev stack:"
echo "  LiveKit  : ws://localhost:7880  (Docker — started above)"
echo "  Laravel  : run in another terminal → cd backend && php artisan serve"
echo "  Next.js  : run in another terminal → cd frontend && pnpm dev"
echo ""
echo "Open http://localhost:3000"
