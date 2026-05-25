# Start script for SlideFlow (Windows Local Environment)
# This script will open new PowerShell windows for each service.

$projectRoot = Get-Location

Write-Host "Starting SlideFlow locally..." -ForegroundColor Green

# 1. Start FastAPI Backend
Write-Host "Starting Backend..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; if (Test-Path venv\Scripts\Activate.ps1) { .\venv\Scripts\Activate.ps1 } else { Write-Host 'Please create and activate venv first (see MANUAL_SETUP.md)' }; uvicorn main:app --host 0.0.0.0 --port 8000 --reload"

# 2. Start Celery Worker (using solo pool for Windows)
Write-Host "Starting Celery Worker..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd backend; if (Test-Path venv\Scripts\Activate.ps1) { .\venv\Scripts\Activate.ps1 } else { Write-Host 'Please create and activate venv first (see MANUAL_SETUP.md)' }; celery -A worker.celery_app worker --pool=solo --loglevel=info"

# 3. Start Next.js Frontend
Write-Host "Starting Frontend..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd frontend; npm run dev"

Write-Host "All services started in separate windows!" -ForegroundColor Green
Write-Host "Backend API: http://localhost:8000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3000" -ForegroundColor Cyan
