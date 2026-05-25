# SlideFlow — Global deployment guide

This repo is configured for production. **You still need cloud accounts, a domain (optional), and API keys** — the steps below are copy-paste ready.

## What you need

| Item | Examples |
|------|----------|
| Domain (optional) | `app.yoursite.com`, `api.yoursite.com` |
| PostgreSQL | Neon, Supabase, Render Postgres |
| Redis | Upstash, Render Redis |
| Frontend host | Vercel (recommended) or Docker |
| API + worker | Render, Railway, Fly.io, or Docker on a VPS |
| Auth | Clerk (production instance) |
| AI | OpenAI API key |

Generate a shared secret:

```powershell
powershell -File scripts/generate-secrets.ps1
```

Copy the token into `INTERNAL_SERVICE_TOKEN` everywhere (frontend, API, Celery).

---

## Option A — Fastest: Vercel + Render

### 1. Database & Redis

1. Create **PostgreSQL** → copy `DATABASE_URL`
2. Create **Redis** → copy `REDIS_URL`
3. Migrate (from your PC, with `DATABASE_URL` set):

   ```bash
   cd frontend
   npx prisma migrate deploy
   ```

### 2. API + Celery on Render

1. Push this repo to GitHub
2. [Render Dashboard](https://dashboard.render.com) → **New Blueprint** → select `render.yaml`
3. When prompted, set sync=false variables:
   - `REDIS_URL`, `DATABASE_URL`
   - `NEXT_API_URL` = your future frontend URL, e.g. `https://slideflow.vercel.app`
   - `CORS_ORIGINS` = same frontend URL
   - `OPENAI_API_KEY`
4. Copy `INTERNAL_SERVICE_TOKEN` from the API service → paste the **same** value into the Celery worker service
5. Note the API URL, e.g. `https://slideflow-api.onrender.com`

### 3. Frontend on Vercel

1. [vercel.com](https://vercel.com) → Import repo → **Root Directory**: `frontend`
2. Environment variables:

   | Variable | Value |
   |----------|--------|
   | `DATABASE_URL` | Postgres connection string |
   | `NEXT_PUBLIC_API_URL` | Render API URL |
   | `FASTAPI_URL` | Same as API URL |
   | `INTERNAL_SERVICE_TOKEN` | Same secret as Render |
   | `CLERK_SECRET_KEY` | Clerk **live** secret |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk **live** publishable |
   | `UPLOADTHING_*`, `OPENAI_API_KEY` | As needed |

3. Deploy → copy Vercel URL
4. Back on Render: set `NEXT_API_URL` and `CORS_ORIGINS` to the Vercel URL → redeploy API + worker

### 4. Clerk

In [Clerk Dashboard](https://dashboard.clerk.com):

- Production URLs: your Vercel domain
- Webhook URL (if used): `https://<vercel-domain>/api/webhooks/clerk`

---

## Option B — One VPS (Docker)

On a Linux server with Docker:

```bash
git clone <your-repo-url>
cd Anti
cp .env.production.example .env
# Edit .env — set passwords, Clerk keys, NEXT_PUBLIC_API_URL, CORS_ORIGINS, etc.
chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
```

Expose ports **3000** (app) and **8000** (API), or put **Nginx** in front:

1. Edit `deploy/nginx.conf` — replace `YOUR_DOMAIN`
2. Install Nginx + Certbot: `sudo certbot --nginx -d app.example.com -d api.example.com`

---

## Option C — All-in Docker locally (test production build)

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml run --rm frontend npx prisma migrate deploy
```

---

## Environment reference

| Variable | Where | Purpose |
|----------|--------|---------|
| `NEXT_PUBLIC_API_URL` | Frontend (build + runtime) | Browser → FastAPI |
| `FASTAPI_URL` | Frontend server routes | Server-side proxy to API |
| `NEXT_API_URL` | Backend + Celery | Worker → Next.js internal APIs |
| `CORS_ORIGINS` | Backend | Comma-separated allowed origins |
| `INTERNAL_SERVICE_TOKEN` | Frontend + Backend + Worker | Service auth |
| `DATABASE_URL` | Frontend (+ optional backend) | Prisma / Postgres |
| `REDIS_URL` | Backend + Worker | Celery + WebSocket pub/sub |

---

## After deploy — smoke test

1. Open frontend URL → sign in (Clerk)
2. Upload a `.pptx` → status should move to processing → parsed
3. API health: `https://<api-url>/health` → `{"status":"healthy"}`
4. WebSocket: dashboard live status updates (requires Redis pub/sub)

---

## What cannot be automated from code

- Creating Vercel / Render / Neon accounts
- Buying or configuring DNS
- Entering API keys in dashboards
- Clerk production approval

Once accounts exist, use the steps above — all config files are in this repo (`render.yaml`, `frontend/vercel.json`, `docker-compose.prod.yml`, `deploy/nginx.conf`).
