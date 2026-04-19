# NoReelsInsta MVP

A distraction-free Instagram posting tool that only includes:
- account connection,
- draft management,
- publishing,
- and viewing published posts.

No feed, reels, explore, or for-you content is embedded.

## What this MVP does

1. Connects to an Instagram **Business/Creator account** through Facebook OAuth.
2. Lets you create/edit/delete local post drafts (image URL + caption).
3. Publishes a draft through Instagram Graph API.
4. Shows a read-only list of published posts.

## Important API limitation

Instagram Graph API does **not** support editing already-published feed posts via API. In this MVP, you can edit drafts before publishing.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example` and fill in your Facebook app values.
3. Run:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`.

## Facebook app scopes used

- `instagram_basic`
- `instagram_content_publish`
- `pages_show_list`
- `pages_read_engagement`
- `business_management`

## Data storage

MVP uses a local JSON file at `data/state.json` for tokens + drafts.
Do not use this storage approach as-is in production.
