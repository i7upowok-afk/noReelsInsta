# NoReelsInsta MVP

A distraction-free Instagram manager focused on:
- connecting an Instagram account by URL,
- creating/editing/deleting drafts,
- uploading draft images from phone gallery or desktop files,
- and avoiding feed/reels distractions.

## Current connection behavior

1. Paste Instagram profile URL (for example: `https://instagram.com/your_username`).
2. Click **Connect with Instagram URL**.
3. App fetches and shows:
   - account username,
   - display name,
   - profile picture.

## Draft image upload

Drafts now use file upload (`<input type="file" accept="image/*">`), which opens:
- photo gallery/camera options on mobile,
- file picker on desktop.

Selected image is stored in draft as a data URL for local MVP use.

## Setup

1. Copy `.env.example` to `.env` (optional; only `PORT` is used).
2. Start:
   ```bash
   npm start
   ```
3. Open `http://localhost:3000`.

## Notes

- URL-only connection can identify and display profile info for public profiles.
- Real posting to Instagram still requires official Instagram API auth flow (OAuth + permissions).
- In this iteration, publishing endpoint is intentionally disabled to keep the URL-only flow simple.
