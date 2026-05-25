#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ ! -f .env ]]; then
  echo "Create .env from .env.example first."
  exit 1
fi

if [[ "${1:-}" == "migrate" ]]; then
  docker compose -f docker-compose.prod.yml run --rm frontend npx prisma migrate deploy
  exit 0
fi

echo "Building and starting SlideFlow (production)..."
docker compose -f docker-compose.prod.yml up -d --build

echo "Running database migrations..."
docker compose -f docker-compose.prod.yml run --rm frontend npx prisma migrate deploy

echo "Done. Frontend :3000  API :8000"
echo "Add Nginx + SSL using deploy/nginx.conf"
