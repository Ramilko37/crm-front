# crm-front

Next.js frontend for CRM backend (`/api/v1`) with stack:

- Next.js App Router + TypeScript
- TanStack Query
- Ant Design
- BFF route handlers with HttpOnly cookie auth

## Requirements

- Node.js 20+
- pnpm
- Running backend (`/Users/rr/Desktop/Frontend/crm`) on `http://127.0.0.1:8000`

## Setup

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Open: <http://127.0.0.1:3000/login>

Default backend creds (dev): `root` / `root`

## Scripts

```bash
pnpm dev
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Architecture

- Browser calls only `crm-front` BFF routes (`/api/*`)
- BFF proxies to backend (`BASE_BACKEND_URL + /api/v1`)
- Access token stored in `HttpOnly` cookie `crm_access_token`
- Protected pages are guarded by `middleware.ts`

## Modules (MVP)

- Login/Profile
- Orders (`/orders`, `/orders/[id]`)
- Factories (`/factories`)
- Trips (`/trips`)

## Report Mapping

See [REPORT_ROADMAP.md](./REPORT_ROADMAP.md).

## Free Deployment

Free production-like deployment (Vercel + Render + Supabase):

- See [DEPLOY_FREE.md](./DEPLOY_FREE.md).
