# SlideFlow

SlideFlow is an AI-powered presentation workflow that parses uploaded decks, generates AI summaries, and streams live processing status to dashboard and presenter views.

## Current Capabilities

- **Frontend**: Next.js 15 (App Router), TypeScript, Tailwind CSS, Clerk auth
- **Backend**: FastAPI + Celery worker for asynchronous parsing
- **Database**: PostgreSQL with Prisma ORM
- **Queue + real-time**: Redis (Celery broker/backend + pub/sub event bus)
- **AI provider**: OpenAI (active)
- **Live presentation controls**: Browser speech recognition + auto-advance logic

## Supported File Types

- **Production-supported**: `.pptx`
- **Planned/installed but not fully wired**: `.pdf`, `.docx`

## Processing Lifecycle

Canonical `PresentationStatus` values:

- `PENDING` -> record created, waiting for processing
- `PROCESSING` -> parsing/AI extraction in progress
- `PARSED` -> slide extraction persisted and ready
- `ERROR` -> terminal processing failure

## High-Level Architecture

1. User uploads file from dashboard.
2. Next.js `upload-proxy` creates a `Presentation` row (`PROCESSING`) and forwards file to FastAPI.
3. FastAPI enqueues Celery `parse_presentation_task`.
4. Worker parses slides, generates AI summaries, writes results to internal Next.js ingestion routes.
5. Worker publishes progress events to Redis pub/sub.
6. FastAPI WebSocket server fans out events to connected clients (`/ws/presentation/{presentationId}`).
7. Dashboard/detail/presenter UIs update live status without manual refresh.

## Internal API Security

Internal ingestion routes are protected with service-to-service authentication:

- Required shared token: `INTERNAL_SERVICE_TOKEN`
- Optional HMAC signature verification: `INTERNAL_SIGNING_SECRET`
- Rate limiting + strict input validation on internal endpoints

Headers used for signed internal calls:

- `x-service-token`
- `x-service-timestamp`
- `x-service-signature`

## Environment Variables

Core variables (see `.env.example`):

- `DATABASE_URL`
- `REDIS_URL`
- `NEXT_PUBLIC_API_URL`
- `FASTAPI_URL`
- `INTERNAL_SERVICE_TOKEN`
- `INTERNAL_SIGNING_SECRET` (optional)
- `REDIS_PUBSUB_CHANNEL` (default: `presentation_events`)
- `WS_HEARTBEAT_SECONDS` (default: `30`)
- `OPENAI_API_KEY`
- `GEMINI_API_KEY` (planned)
- `DEEPGRAM_API_KEY` (planned)
- Clerk keys (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`)

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js + npm (if running frontend outside Docker)
- Python 3.12+ (if running backend outside Docker)

### Setup

1. Clone repository.
2. Copy `.env.example` to `.env` and fill required values.
3. Start the stack:
   ```bash
   docker compose up --build
   ```

### Services

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:8000`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Deploy globally

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for Vercel + Render, VPS Docker, and production env vars.

Quick VPS deploy:

```bash
cp .env.production.example .env   # fill in values
./scripts/deploy-vps.sh
```
