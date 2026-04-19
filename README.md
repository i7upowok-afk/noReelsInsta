# NoReels Insta Manager (MVP)

Distraction-free Instagram management MVP built with:
- Next.js + TypeScript + Tailwind
- Node API routes
- PostgreSQL + Prisma (with file-store fallback for quick local testing)
- Official Meta Instagram Graph API only

## What you can test immediately (MVP)

Even without Meta credentials or Postgres, you can run and open the dashboard in **mock mode**.

- Open: `http://localhost:3000/dashboard`
- Health check: `http://localhost:3000/api/health`

## Required feature coverage

- Meta OAuth sign-in routes (`/api/oauth/start`, `/api/oauth/callback`)
- Secure server-side token storage (encrypted before persistence)
- Dashboard tabs: Create / Drafts / Posts / Comments / Insights
- Create tab: upload media, caption, preview, publish
- Posts tab: recent posts
- Comments tab: list comments + reply
- Insights tab: basic metrics when available
- No feed/explore/reels/follower browsing/scraping/password login

## Environment variables

Copy `.env.example` to `.env`:

- `DATABASE_URL`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`
- `META_API_VERSION`
- `TOKEN_ENCRYPTION_KEY`
- `NEXT_PUBLIC_APP_URL`

## Quick start (mock MVP, easiest)

1. Install:
   ```bash
   npm install
   ```
2. Start app:
   ```bash
   npm run dev
   ```
3. Open:
   - `http://localhost:3000/dashboard`

If Meta env vars are missing, APIs return mock data so UI is testable.

## Full start (Postgres + Prisma)

1. Start Postgres:
   ```bash
   docker compose up -d
   ```
2. Install + Prisma:
   ```bash
   npm install
   npm run prisma:generate
   npm run prisma:migrate
   ```
3. Run app:
   ```bash
   npm run dev
   ```

## Meta OAuth setup notes

- In Meta app settings, set OAuth redirect URI exactly to `META_REDIRECT_URI`.
- OAuth callback exchanges code server-side and stores encrypted token.
- Publish/comments/insights use Graph API and fall back to mock when unavailable.

## Restrictions

- No feed
- No Explore
- No Reels
- No follower browsing
- No scraping
- No direct Instagram password login
- Official Meta Instagram API only
