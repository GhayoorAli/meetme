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
