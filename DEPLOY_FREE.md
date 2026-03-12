# Free Deploy (Vercel + Render + Supabase)

This guide deploys:

- `crm` (FastAPI backend) to Render Free
- PostgreSQL to Supabase Free
- `crm-front` (Next.js + BFF) to Vercel Hobby

## 1) Deploy database (Supabase)

1. Create a free Supabase project.
2. Open project settings and copy the Postgres connection string (URI format).
3. Keep this value for Render as `DATABASE_URL`.

Note: `crm` normalizes common Postgres URLs (including `postgres://...`) to `postgresql+asyncpg://...` automatically.

## 2) Deploy backend `crm` (Render)

Repository: `https://github.com/kozpavelp/crm` (branch `dev`).

1. In Render, create a new **Blueprint** from the backend repo.
2. Render will read [`render.yaml`](/Users/rr/Desktop/Frontend/crm/render.yaml).
3. Set required env values in the service:
   - `DATABASE_URL` = Supabase connection string
   - `SUPERUSER_PASSWORD` = strong password
   - `SUPERUSER_LOGIN` = `root` (or your value)
   - `ACCESS_TOKEN_SECRET` = auto-generated or your strong secret
4. Deploy.

Backend healthcheck URL after deploy:

- `https://<your-render-service>.onrender.com/health`

Expected response:

```json
{"status":"ok"}
```

## 3) Deploy frontend `crm-front` (Vercel)

1. Import/push `crm-front` repository to GitHub (if not already hosted).
2. In Vercel, create a new project from that repo.
3. Set environment variable:
   - `BASE_BACKEND_URL=https://<your-render-service>.onrender.com`
4. Deploy.

`vercel.json` already sets longer function duration for BFF routes to reduce cold-start failures on free backend.

## 4) Smoke checks

1. Open `https://<your-vercel-domain>/login`.
2. Login with your backend superuser credentials.
3. Verify pages load:
   - `/orders`
   - `/factories`
   - `/trips`
   - `/profile`
4. Logout and verify redirect back to `/login`.

## 5) Free-tier caveats

- Render Free service sleeps after inactivity; first request can be slow.
- Supabase Free projects may pause after prolonged inactivity.
