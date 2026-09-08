#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "==> Starting Docker (PostgreSQL + LiveKit)..."
cd "$ROOT"
docker compose up -d --remove-orphans

echo "==> Service status:"
docker compose ps

echo ""
echo "MeetMe local stack:"
echo "  PostgreSQL : 127.0.0.1:5432  (meet_db / meetme / meetme)"
echo "  LiveKit    : ws://localhost:7880"
echo ""
echo "  Web        : cd frontend && pnpm install && pnpm db:migrate && pnpm dev"
echo "  App        : http://localhost:3000"
echo "  Mobile     : cd mobile && npx expo start"
echo ""
echo "Set EXPO_PUBLIC_API_URL to http://<your-lan-ip>:3000 for a physical device."
