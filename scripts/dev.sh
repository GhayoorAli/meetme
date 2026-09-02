#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Starting full Docker stack (MySQL, LiveKit, phpMyAdmin, Laravel, Next.js)..."
cd "$ROOT"
docker compose up -d --build

echo "==> Service status:"
docker compose ps

echo ""
echo "MeetMe is ready (Docker only — no host PHP/Node needed):"
echo "  App       : http://localhost:3000"
echo "  API       : http://localhost:8000"
echo "  phpMyAdmin: http://localhost:8080"
echo "  MySQL     : 127.0.0.1:3307  (meet_db / root / root)"
echo "  LiveKit   : ws://localhost:7880"
echo ""
echo "Logs: docker compose logs -f frontend backend"
