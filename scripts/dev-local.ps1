$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

Write-Host "==> Starting PostgreSQL and LiveKit..."
docker compose up -d --remove-orphans
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "MeetMe local stack:"
Write-Host "  PostgreSQL : 127.0.0.1:5432  (meet_db / meetme / meetme)"
Write-Host "  LiveKit    : ws://localhost:7880"
Write-Host ""
Write-Host "  Web        : cd frontend && pnpm install && pnpm db:migrate && pnpm dev"
Write-Host "  App        : http://localhost:3000"
Write-Host "  Mobile     : cd mobile && npx expo start"
Write-Host ""
Write-Host "For a phone on Wi-Fi, set EXPO_PUBLIC_API_URL to http://<your-lan-ip>:3000"
Write-Host "and LIVEKIT_URL to ws://<your-lan-ip>:7880"
