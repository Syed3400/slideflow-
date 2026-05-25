# SlideFlow Manual Local Setup Guide (Windows)

Due to Docker Desktop virtualization issues, this guide explains how to run the SlideFlow stack completely manually on Windows. 

We will be running the following components natively:
1. PostgreSQL (Database)
2. Redis (Message Broker / Cache)
3. FastAPI Backend & Celery Worker
4. Next.js Frontend

---

## 1. Prerequisites Installation

### Node.js 22
1. Download the Windows Installer (.msi) for Node.js 22 from the [official Node.js website](https://nodejs.org/).
2. Run the installer and follow the prompts. Ensure "Add to PATH" is checked.
3. Verify installation in PowerShell:
   ```powershell
   node -v
   npm -v
   ```

### Python 3.12
1. Download the Windows Installer for Python 3.12 from the [Python website](https://www.python.org/downloads/).
2. **Crucial:** Check the box **"Add python.exe to PATH"** at the bottom of the installer window before clicking "Install Now".
3. Verify installation:
   ```powershell
   python --version
   pip --version
   ```

### PostgreSQL 15 (or latest)
1. Download the interactive installer from [EnterpriseDB](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads).
2. During installation:
   - Remember the password you set for the default `postgres` user (set it to `password` to match the default `.env`).
   - Keep the default port `5432`.
   - Install pgAdmin if you want a GUI to manage your database.

### Redis for Windows
Redis doesn't officially support Windows natively, but you can use Memurai (a Redis-compatible cache for Windows) or the native Windows port.
**Option A: WSL (Recommended for Redis)**
If WSL is disabled, proceed to Option B.
**Option B: Memurai (Native Windows)**
1. Download the Developer Edition from [Memurai](https://www.memurai.com/).
2. Install it. It runs as a background Windows service automatically on port `6379`.
3. Test it in PowerShell using: `memurai-cli ping` (should return `PONG`).

---

## 2. Database Creation

Once PostgreSQL is installed, you need to create the `slideflow` database.

1. Open **pgAdmin 4** (installed with PostgreSQL) or use `psql` in PowerShell:
   ```powershell
   psql -U postgres
   ```
   *(If `psql` is not recognized, add `C:\Program Files\PostgreSQL\15\bin` to your system PATH).*
2. Enter the password you set during installation.
3. Run the SQL command to create the database:
   ```sql
   CREATE DATABASE slideflow;
   \q
   ```

---

## 3. Environment Variables

The project comes with a `.env.example` file. 
For local setup, the default values in `.env.example` already point to `localhost`.

1. Copy `.env.example` and rename it to `.env` in the root folder of the project.
2. Verify the following lines in `.env` match your local setup:
   ```env
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=password  # Change this if you set a different password during Postgres installation
   POSTGRES_DB=slideflow
   DATABASE_URL=postgresql://postgres:password@localhost:5432/slideflow
   
   REDIS_URL=redis://localhost:6379/0
   
   NEXT_PUBLIC_API_URL=http://localhost:8000
   FASTAPI_URL=http://localhost:8000

   # Internal service-to-service auth (required for ingestion)
   INTERNAL_SERVICE_TOKEN=replace_with_shared_service_token
   # Optional request signing secret (recommended in non-local deployments)
   INTERNAL_SIGNING_SECRET=

   # Real-time event bus + heartbeat
   REDIS_PUBSUB_CHANNEL=presentation_events
   WS_HEARTBEAT_SECONDS=30
   ```

> Notes:
> - `.pptx` is the currently supported production parsing format.
> - `.pdf` / `.docx` dependencies are present but full parsing flow is still planned.
> - OpenAI is currently active for summaries; Gemini/Deepgram are planned paths.

---

## 4. Setting Up and Running the Services

### A. Backend (FastAPI) & Worker (Celery)
Open a new PowerShell window, navigate to your project folder, and run:

```powershell
cd backend
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Starting the Celery Worker (Important for Windows)**
Celery on Windows requires the `solo` pool. Open *another* PowerShell window, activate the venv, and run:
```powershell
cd backend
.\venv\Scripts\Activate.ps1
celery -A worker.celery_app worker --pool=solo --loglevel=info
```

The backend now exposes a real-time WebSocket endpoint at:

- `ws://localhost:8000/ws/presentation/{presentationId}`

This streams processing lifecycle events (`processing_started`, `slide_parsed`, `progress`, `completed`, `failed`) used by the frontend live status UI.

### B. Frontend (Next.js)
Open a new PowerShell window, navigate to your project folder, and run:

```powershell
cd frontend

# Install Node dependencies
npm install

# Start the development server
npm run dev
```

---

## 5. Automated Startup Script

To make things easier, a `start_local.ps1` script has been generated in the root of the project. Once you have installed the prerequisites and set up your Python virtual environment, you can run this script to start the Backend, Celery Worker, and Frontend simultaneously in separate windows.

```powershell
.\start_local.ps1
```
