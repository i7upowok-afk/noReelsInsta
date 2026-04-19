import express from 'express';
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, 'data');
const stateFile = path.join(dataDir, 'state.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const requiredEnv = ['FB_APP_ID', 'FB_APP_SECRET', 'FB_REDIRECT_URI'];

async function readState() {
  try {
    const raw = await fs.readFile(stateFile, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {
      connectedAt: null,
      accessToken: null,
      igUserId: null,
      drafts: []
    };
  }
}

async function writeState(state) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
}

function hasOauthConfig() {
  return requiredEnv.every((key) => Boolean(process.env[key]));
}

app.get('/api/config', (_req, res) => {
  res.json({
    hasOauthConfig: hasOauthConfig(),
    missing: requiredEnv.filter((key) => !process.env[key])
  });
});

app.get('/api/connect-url', (_req, res) => {
  if (!hasOauthConfig()) {
    return res.status(400).json({ error: 'Missing OAuth env vars.' });
  }

  const params = new URLSearchParams({
    client_id: process.env.FB_APP_ID,
    redirect_uri: process.env.FB_REDIRECT_URI,
    response_type: 'code',
    scope: [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
      'business_management'
    ].join(',')
  });

  res.json({
    url: `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}`
  });
});

app.get('/auth/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Missing code query parameter.');
  }

  if (!hasOauthConfig()) {
    return res.status(500).send('OAuth env vars are missing.');
  }

  try {
    const tokenParams = new URLSearchParams({
      client_id: process.env.FB_APP_ID,
      client_secret: process.env.FB_APP_SECRET,
      redirect_uri: process.env.FB_REDIRECT_URI,
      code: String(code)
    });

    const tokenRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${tokenParams.toString()}`);
    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      return res.status(500).send(`Failed to get access token: ${text}`);
    }

    const tokenData = await tokenRes.json();
    const accessToken = tokenData.access_token;

    const pagesRes = await fetch(`https://graph.facebook.com/v20.0/me/accounts?fields=name,instagram_business_account&access_token=${accessToken}`);
    const pagesData = await pagesRes.json();
    const firstWithIg = pagesData?.data?.find((p) => p.instagram_business_account?.id);

    const state = await readState();
    state.accessToken = accessToken;
    state.connectedAt = new Date().toISOString();
    state.igUserId = firstWithIg?.instagram_business_account?.id || null;
    await writeState(state);

    res.redirect('/?connected=1');
  } catch (error) {
    res.status(500).send(`OAuth callback failed: ${error.message}`);
  }
});

app.get('/api/session', async (_req, res) => {
  const state = await readState();
  res.json({
    connected: Boolean(state.accessToken),
    connectedAt: state.connectedAt,
    igUserId: state.igUserId,
    draftCount: state.drafts.length
  });
});

app.get('/api/drafts', async (_req, res) => {
  const state = await readState();
  res.json(state.drafts);
});

app.post('/api/drafts', async (req, res) => {
  const { caption, imageUrl } = req.body;
  if (!caption || !imageUrl) {
    return res.status(400).json({ error: 'caption and imageUrl are required.' });
  }

  const state = await readState();
  const draft = {
    id: randomUUID(),
    caption,
    imageUrl,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  state.drafts.unshift(draft);
  await writeState(state);
  res.status(201).json(draft);
});

app.put('/api/drafts/:id', async (req, res) => {
  const { id } = req.params;
  const { caption, imageUrl } = req.body;
  const state = await readState();
  const idx = state.drafts.findIndex((d) => d.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: 'Draft not found.' });
  }

  state.drafts[idx] = {
    ...state.drafts[idx],
    caption: caption ?? state.drafts[idx].caption,
    imageUrl: imageUrl ?? state.drafts[idx].imageUrl,
    updatedAt: new Date().toISOString()
  };

  await writeState(state);
  res.json(state.drafts[idx]);
});

app.delete('/api/drafts/:id', async (req, res) => {
  const { id } = req.params;
  const state = await readState();
  state.drafts = state.drafts.filter((d) => d.id !== id);
  await writeState(state);
  res.status(204).send();
});

app.get('/api/posts', async (_req, res) => {
  const state = await readState();
  if (!state.accessToken || !state.igUserId) {
    return res.status(400).json({ error: 'Connect Instagram business account first.' });
  }

  const fields = ['id', 'caption', 'media_type', 'media_url', 'permalink', 'timestamp'].join(',');
  const url = `https://graph.facebook.com/v20.0/${state.igUserId}/media?fields=${fields}&access_token=${state.accessToken}`;
  const postsRes = await fetch(url);
  const data = await postsRes.json();

  if (!postsRes.ok) {
    return res.status(400).json({ error: data?.error?.message || 'Unable to fetch posts.' });
  }

  res.json(data.data || []);
});

app.post('/api/publish/:draftId', async (req, res) => {
  const state = await readState();
  const draft = state.drafts.find((d) => d.id === req.params.draftId);

  if (!draft) {
    return res.status(404).json({ error: 'Draft not found.' });
  }

  if (!state.accessToken || !state.igUserId) {
    return res.status(400).json({ error: 'Connect Instagram business account first.' });
  }

  try {
    const createContainerParams = new URLSearchParams({
      image_url: draft.imageUrl,
      caption: draft.caption,
      access_token: state.accessToken
    });

    const containerRes = await fetch(`https://graph.facebook.com/v20.0/${state.igUserId}/media?${createContainerParams.toString()}`, { method: 'POST' });
    const containerData = await containerRes.json();

    if (!containerRes.ok) {
      return res.status(400).json({ error: containerData?.error?.message || 'Failed to create media container.' });
    }

    const publishParams = new URLSearchParams({
      creation_id: containerData.id,
      access_token: state.accessToken
    });

    const publishRes = await fetch(`https://graph.facebook.com/v20.0/${state.igUserId}/media_publish?${publishParams.toString()}`, { method: 'POST' });
    const publishData = await publishRes.json();

    if (!publishRes.ok) {
      return res.status(400).json({ error: publishData?.error?.message || 'Failed to publish media.' });
    }

    state.drafts = state.drafts.filter((d) => d.id !== draft.id);
    await writeState(state);

    res.json({ ok: true, publishId: publishData.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/posts/:id', (_req, res) => {
  res.status(400).json({
    error: 'Instagram Graph API does not support editing already-published feed media. Duplicate the post as a new draft and publish again.'
  });
});

app.listen(port, () => {
  console.log(`NoReelsInsta MVP listening on http://localhost:${port}`);
});
