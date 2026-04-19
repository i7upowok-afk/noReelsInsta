# NoReelsInsta MVP

A distraction-free Instagram posting tool that only includes:
- account connection,
- draft management,
- publishing,
- and viewing published posts.

No feed, reels, explore, or for-you content is embedded.

## What this MVP does

1. Connects to your Instagram Business/Creator account through Facebook OAuth.
2. Lists your Facebook Pages and lets you choose which linked Instagram account to post from.
3. Lets you create/edit/delete local post drafts (image URL + caption).
4. Publishes a draft through Instagram Graph API.
5. Shows a read-only list of published posts.
6. Includes a connection verification check so you can confirm auth is working.

## Instagram connection requirements

To connect and publish successfully, your Instagram account must be:
- Professional (Business or Creator),
- linked to a Facebook Page,
- and your Facebook app must have these permissions approved for your app mode.

## Important API limitation

Instagram Graph API does **not** support editing already-published feed posts via API. In this MVP, you can edit drafts before publishing.

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create `.env` from `.env.example` and fill in your Facebook app values.
3. In your Facebook app settings, add the exact OAuth redirect URI from `.env`.
4. Run:
   ```bash
   npm run dev
   ```
5. Open `http://localhost:3000`.
6. Click **Connect with Facebook**, approve scopes, then select the page/IG account in the dropdown.
7. Click **Verify connection**.

## Facebook app scopes used

- `instagram_basic`
- `instagram_content_publish`
- `pages_show_list`
- `pages_read_engagement`
- `business_management`

## Data storage

MVP uses a local JSON file at `data/state.json` for tokens + drafts.
Do not use this storage approach as-is in production.
