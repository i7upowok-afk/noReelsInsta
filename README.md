# NoReelsInsta MVP

A distraction-free Instagram posting tool that only includes:
- account connection,
- draft management,
- publishing,
- and viewing published posts.

No feed, reels, explore, or for-you content is embedded.

## What changed for connection

This version connects by letting you paste your **Instagram profile URL** directly (for example `https://instagram.com/your_username`).

- No "Connect with Facebook" button.
- Buttons are wired to local API endpoints with no external npm dependencies required.
- If you also add `access token` + `Instagram User ID`, publishing and post listing work through Instagram Graph API.

## Setup

1. Copy `.env.example` to `.env` (optional; only `PORT` is used).
2. Start:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000`.

## Connect flow

1. Paste your Instagram profile URL.
2. (Optional for publishing) add:
   - Instagram Graph access token
   - Instagram User ID
3. Click **Connect with Instagram URL**.
4. Click **Verify API connection** to validate token/user ID.

## Publishing requirements

To publish through API, Instagram still requires:
- Professional account (Business/Creator),
- Graph API access token with proper permissions,
- valid Instagram User ID linked for content publishing.

## Important API limitation

Instagram Graph API does **not** support editing already-published feed posts via API. In this MVP, you can edit drafts before publishing.

## Data storage

MVP uses a local JSON file at `data/state.json` for connection state and drafts.
