# One-command VPS deploy (Linux server with Docker + Docker Compose v2)
# Usage on the server:
#   git clone <repo> && cd Anti
#   cp .env.example .env   # edit with production values
#   ./scripts/deploy-vps.sh

param(
    [switch]$MigrateOnly
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

if (-not (Test-Path ".env")) {
    Write-Host "Create .env from .env.example first." -ForegroundColor Red
    exit 1
}

if ($MigrateOnly) {
    docker compose -f docker-compose.prod.yml run --rm frontend npx prisma migrate deploy
    exit $LASTEXITCODE
}

Write-Host "Building and starting SlideFlow (production)..." -ForegroundColor Green
docker compose -f docker-compose.prod.yml up -d --build

Write-Host "Running database migrations..." -ForegroundColor Green
docker compose -f docker-compose.prod.yml run --rm frontend npx prisma migrate deploy

Write-Host "Done. Frontend :3000  API :8000  (put Nginx/SSL in front — see deploy/nginx.conf)" -ForegroundColor Cyan
