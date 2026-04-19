# NoReels Insta Manager (Next.js MVP)

This is a distraction-free Instagram management app built with:
- Next.js + TypeScript
- Tailwind CSS
- API Routes (Node server runtime)
- PostgreSQL + Prisma

It intentionally excludes feed/explore/reels/follower browsing and uses official Meta Instagram APIs only.

## Features implemented

- **Meta OAuth sign-in** (`/api/oauth/start`, `/api/oauth/callback`)
- **Secure server-side token storage** (encrypted token in PostgreSQL)
- **Dashboard tabs**:
  - Create
  - Drafts
  - Posts
  - Comments
  - Insights
- **Create tab**:
  - media upload for local preview
  - caption input
  - preview panel
  - publish action
- **Posts tab**:
  - recent published posts
- **Comments tab**:
  - list comments from recent media
  - reply to comments
- **Insights tab**:
  - basic metrics when available
- **Mock fallback mode** when credentials/token are missing

## Environment variables

Copy `.env.example` to `.env` and set:

- `DATABASE_URL`
- `META_APP_ID`
- `META_APP_SECRET`
- `META_REDIRECT_URI`
- `META_API_VERSION` (optional, default `v20.0`)
- `TOKEN_ENCRYPTION_KEY`
- `NEXT_PUBLIC_APP_URL`

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Generate Prisma client:
   ```bash
   npm run prisma:generate
   ```
3. Run database migration:
   ```bash
   npm run prisma:migrate
   ```
4. Start development server:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000/dashboard`

## Notes

- For real publishing, the `mediaUrl` must be publicly reachable by Meta Graph API.
- OAuth and publish/comment/insights calls use the official Graph API flow.
- If credentials are missing, routes return mock data to keep UI testable.

## Restrictions (enforced by product scope)

- No feed
- No Explore
- No Reels
- No follower browsing
- No scraping
- No direct Instagram password login
- Official Meta Instagram API only
