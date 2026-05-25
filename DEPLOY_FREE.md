# SlideFlow — 100% free deployment (no Render)

Render Blueprint / background **workers are paid**. This guide uses only free tiers.

| Piece | Free host |
|-------|-----------|
| Frontend (Next.js) | **Vercel** Hobby |
| API + Celery worker | **Fly.io** (one app, two processes) |
| PostgreSQL | **Neon** |
| Redis | **Upstash** |
| Auth | **Clerk** (free dev tier; 10k MAU) |

**Cost:** $0/month if you stay within free limits (no credit card on Vercel/Neon/Upstash; Fly may ask for a card but does not charge on free allowance).

---

## Part 1 — Free database & Redis

### Neon (Postgres)

1. [neon.tech](https://neon.tech) → Sign up → **New project**
2. Copy **connection string** → save as `DATABASE_URL`

### Upstash (Redis)

1. [upstash.com](https://upstash.com) → **Create database** → Regional
2. Copy **Redis URL** → save as `REDIS_URL`

### Migrate DB (on your PC)

```powershell
cd C:\Users\syedy\Desktop\Anti\frontend
$env:DATABASE_URL = "postgresql://..."   # Neon URL
npx prisma migrate deploy
```

### Generate service token

```powershell
cd C:\Users\syedy\Desktop\Anti
powershell -File scripts\generate-secrets.ps1
```

Save `INTERNAL_SERVICE_TOKEN`.

---

## Part 2 — Fly.io (API + worker, free)

Fly runs **both** the FastAPI server and the Celery worker in one app (`backend/fly.toml`), so you do not need a paid Render worker.

### 2.1 Install Fly CLI

1. [fly.io/docs/hands-on/install-flyctl](https://fly.io/docs/hands-on/install-flyctl/)
2. Windows (PowerShell):

   ```powershell
   winget install flyio.flyctl
   ```

3. Login:

   ```powershell
   fly auth login
   ```

### 2.2 Create the app (first time only)

```powershell
cd C:\Users\syedy\Desktop\Anti\backend
fly launch --no-deploy
```

- Use existing `fly.toml` when asked
- App name: e.g. `slideflow-api` (must be globally unique — try `slideflow-api-YOURNAME`)
- Region: pick closest (e.g. `iad` US East)
- Do **not** add Postgres/Redis on Fly (you use Neon + Upstash)

### 2.3 Set secrets on Fly

Replace placeholders with your real values. Use a **placeholder** for frontend URL first; update after Vercel deploy.

```powershell
fly secrets set `
  REDIS_URL="rediss://default:xxx@xxx.upstash.io:6379" `
  NEXT_API_URL="https://YOUR-APP.vercel.app" `
  CORS_ORIGINS="https://YOUR-APP.vercel.app" `
  INTERNAL_SERVICE_TOKEN="your-token-from-generate-secrets" `
  OPENAI_API_KEY="sk-..."
```

Optional:

```powershell
fly secrets set INTERNAL_SIGNING_SECRET="any-random-string"
```

### 2.4 Deploy

```powershell
fly deploy
```

When finished:

```powershell
fly status
fly open /health
```

You should see `{"status":"healthy"}`. Copy your API URL, e.g. `https://slideflow-api-YOURNAME.fly.dev`.

### 2.5 Check worker is running

```powershell
fly logs --process worker
```

You should see Celery worker startup lines, not only errors.

---

## Part 3 — Vercel (frontend, free)

1. [vercel.com](https://vercel.com) → **Add New Project** → import `Syed3400/slideflow-` (or your repo)
2. **Root Directory:** `frontend`
3. **Environment variables** (Production):

| Variable | Value |
|----------|--------|
| `DATABASE_URL` | Neon URL |
| `NEXT_PUBLIC_API_URL` | `https://slideflow-api-YOURNAME.fly.dev` |
| `FASTAPI_URL` | Same Fly URL |
| `INTERNAL_SERVICE_TOKEN` | Same as Fly |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk |
| `CLERK_SECRET_KEY` | Clerk |
| `CLERK_WEBHOOK_SECRET` | Clerk webhook signing secret |
| `OPENAI_API_KEY` | OpenAI |

4. **Deploy** → copy URL, e.g. `https://slideflow-xxx.vercel.app`

### 3.1 Update Fly with real frontend URL

```powershell
cd C:\Users\syedy\Desktop\Anti\backend
fly secrets set `
  NEXT_API_URL="https://slideflow-xxx.vercel.app" `
  CORS_ORIGINS="https://slideflow-xxx.vercel.app"
fly deploy
```

Worker must call your real Vercel URL for internal APIs.

---

## Part 4 — Clerk (free tier)

1. [dashboard.clerk.com](https://dashboard.clerk.com) → your app
2. **Domains** → add Vercel URL
3. **Webhooks** → endpoint: `https://slideflow-xxx.vercel.app/api/webhooks/clerk`
4. Copy signing secret → `CLERK_WEBHOOK_SECRET` on Vercel → **Redeploy**

Development keys (`pk_test_` / `sk_test_`) work for testing globally.

---

## Part 5 — Test

1. `https://YOUR-APP.vercel.app` → sign in
2. Upload `.pptx` → should process (watch `fly logs --process worker`)
3. `https://YOUR-API.fly.dev/health` → healthy

---

## Free tier limits (know these)

| Service | Limit |
|---------|--------|
| Vercel Hobby | Personal/non-commercial; bandwidth caps |
| Neon free | ~0.5 GB storage, compute caps |
| Upstash free | 10k Redis commands/day |
| Fly.io free | Shared VMs; machines **sleep** when idle (cold start ~10–30s) |
| Clerk free | 10,000 monthly active users (dev instance) |

First request after idle may be slow on Fly — normal on free tier.

---

## Alternative: Oracle Cloud “Always Free” VPS

If Fly asks for payment or you want one server for everything:

1. [Oracle Cloud Free Tier](https://www.oracle.com/cloud/free/) → create an **Ampere** VM (Ubuntu)
2. Install Docker on the VM
3. Clone repo, copy `.env.production.example` → `.env`, fill values
4. Run `./scripts/deploy-vps.sh`

You get a real IP; point a domain or use the public IP (HTTP only unless you add Certbot).

---

## What NOT to use for free

| Service | Why |
|---------|-----|
| Render Blueprint + **worker** | Workers are **paid** on Render |
| Render `starter` plan in `render.yaml` | Not free |
| Hosting only on Vercel | No Celery — uploads will not parse |

---

## Quick command cheat sheet

```powershell
# Fly
cd backend
fly deploy
fly logs
fly secrets list

# Vercel — redeploy after env change
# Use Vercel dashboard → Deployments → Redeploy

# DB migrate
cd frontend
$env:DATABASE_URL="..."
npx prisma migrate deploy
```
