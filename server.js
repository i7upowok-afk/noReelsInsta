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

const requiredEnv = ['FB_APP_ID', 'FB_APP_SECRET', 'FB_REDIRECT_URI'];

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function readState() {
  try {
    return JSON.parse(await fs.readFile(stateFile, 'utf8'));
  } catch {
    return {
      connectedAt: null,
      accessToken: null,
      tokenType: null,
      expiresIn: null,
      igUserId: null,
      selectedPageId: null,
      pages: [],
      oauthState: null,
      drafts: []
    };
  }
}

async function writeState(state) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
}

function hasOauthConfig() {
  return requiredEnv.every((k) => Boolean(process.env[k]));
}

async function graphFetch(pathname, accessToken, options = {}) {
  const sep = pathname.includes('?') ? '&' : '?';
  const url = `https://graph.facebook.com/v20.0${pathname}${sep}access_token=${encodeURIComponent(accessToken)}`;
  const response = await fetch(url, options);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `Graph API request failed: ${response.status}`);
  }

  return data;
}

function sanitizePage(page) {
  return {
    id: page.id,
    name: page.name,
    igUserId: page.instagram_business_account?.id || null,
    hasInstagramBusiness: Boolean(page.instagram_business_account?.id)
  };
}

async function fetchPagesWithInstagram(accessToken) {
  const pages = await graphFetch('/me/accounts?fields=id,name,instagram_business_account', accessToken);
  return (pages.data || []).map(sanitizePage);
}

app.get('/api/config', (_req, res) => {
  res.json({
    hasOauthConfig: hasOauthConfig(),
    missing: requiredEnv.filter((k) => !process.env[k])
  });
});

app.get('/api/connect-url', async (_req, res) => {
  if (!hasOauthConfig()) {
    return res.status(400).json({ error: 'Missing OAuth env vars.' });
  }

  const state = await readState();
  state.oauthState = randomUUID();
  await writeState(state);

  const params = new URLSearchParams({
    client_id: process.env.FB_APP_ID,
    redirect_uri: process.env.FB_REDIRECT_URI,
    response_type: 'code',
    state: state.oauthState,
    scope: [
      'instagram_basic',
      'instagram_content_publish',
      'pages_show_list',
      'pages_read_engagement',
      'business_management'
    ].join(',')
  });

  res.json({ url: `https://www.facebook.com/v20.0/dialog/oauth?${params.toString()}` });
});

app.get('/auth/callback', async (req, res) => {
  const { code, state: returnedState, error, error_description: errorDescription } = req.query;

  if (error) {
    return res.redirect(`/?connected=0&error=${encodeURIComponent(String(errorDescription || error))}`);
  }

  if (!code) {
    return res.redirect('/?connected=0&error=Missing+authorization+code');
  }

  if (!hasOauthConfig()) {
    return res.redirect('/?connected=0&error=Missing+OAuth+environment+variables');
  }

  try {
    const localState = await readState();
    if (!localState.oauthState || returnedState !== localState.oauthState) {
      return res.redirect('/?connected=0&error=Invalid+OAuth+state');
    }

    const tokenParams = new URLSearchParams({
      client_id: process.env.FB_APP_ID,
      client_secret: process.env.FB_APP_SECRET,
      redirect_uri: process.env.FB_REDIRECT_URI,
      code: String(code)
    });

    const shortTokenRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${tokenParams.toString()}`);
    const shortTokenData = await shortTokenRes.json();
    if (!shortTokenRes.ok || !shortTokenData.access_token) {
      throw new Error(shortTokenData?.error?.message || 'Failed to retrieve short-lived user token.');
    }

    const longTokenParams = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: process.env.FB_APP_ID,
      client_secret: process.env.FB_APP_SECRET,
      fb_exchange_token: shortTokenData.access_token
    });

    const longTokenRes = await fetch(`https://graph.facebook.com/v20.0/oauth/access_token?${longTokenParams.toString()}`);
    const longTokenData = await longTokenRes.json();

    const activeToken = longTokenData.access_token || shortTokenData.access_token;
    const expiresIn = longTokenData.expires_in || shortTokenData.expires_in || null;

    const pages = await fetchPagesWithInstagram(activeToken);
    const firstConnected = pages.find((p) => p.igUserId);

    localState.accessToken = activeToken;
    localState.tokenType = longTokenData.access_token ? 'long_lived_user' : 'short_lived_user';
    localState.expiresIn = expiresIn;
    localState.connectedAt = new Date().toISOString();
    localState.pages = pages;
    localState.selectedPageId = firstConnected?.id || null;
    localState.igUserId = firstConnected?.igUserId || null;
    localState.oauthState = null;
    await writeState(localState);

    res.redirect('/?connected=1');
  } catch (e) {
    res.redirect(`/?connected=0&error=${encodeURIComponent(String(e.message || e))}`);
  }
});

app.get('/api/session', async (_req, res) => {
  const state = await readState();
  const selectedPage = state.pages.find((p) => p.id === state.selectedPageId) || null;

  res.json({
    connected: Boolean(state.accessToken),
    connectedAt: state.connectedAt,
    tokenType: state.tokenType,
    expiresIn: state.expiresIn,
    igUserId: state.igUserId,
    selectedPage,
    pages: state.pages,
    draftCount: state.drafts.length
  });
});

app.post('/api/select-page', async (req, res) => {
  const { pageId } = req.body;
  const state = await readState();

  if (!state.accessToken) {
    return res.status(400).json({ error: 'Connect Instagram first.' });
  }

  const page = state.pages.find((p) => p.id === pageId);
  if (!page) {
    return res.status(404).json({ error: 'Page not found in connected account.' });
  }

  if (!page.igUserId) {
    return res.status(400).json({ error: 'That page is not linked to an Instagram Business account.' });
  }

  state.selectedPageId = page.id;
  state.igUserId = page.igUserId;
  await writeState(state);

  res.json({ ok: true, igUserId: state.igUserId });
});

app.get('/api/connection-check', async (_req, res) => {
  const state = await readState();
  if (!state.accessToken) {
    return res.status(400).json({ ok: false, error: 'No active token. Connect first.' });
  }

  try {
    const me = await graphFetch('/me?fields=id,name', state.accessToken);
    let igAccount = null;

    if (state.igUserId) {
      igAccount = await graphFetch(`/${state.igUserId}?fields=id,username,account_type`, state.accessToken);
    }

    res.json({ ok: true, me, igAccount });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
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
    return res.status(400).json({ error: 'Connect an Instagram business account and choose a linked page first.' });
  }

  try {
    const fields = ['id', 'caption', 'media_type', 'media_url', 'permalink', 'timestamp'].join(',');
    const data = await graphFetch(`/${state.igUserId}/media?fields=${fields}`, state.accessToken);
    res.json(data.data || []);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.post('/api/publish/:draftId', async (req, res) => {
  const state = await readState();
  const draft = state.drafts.find((d) => d.id === req.params.draftId);

  if (!draft) {
    return res.status(404).json({ error: 'Draft not found.' });
  }

  if (!state.accessToken || !state.igUserId) {
    return res.status(400).json({ error: 'Connect an Instagram business account and choose a linked page first.' });
  }

  try {
    const createBody = new URLSearchParams({
      image_url: draft.imageUrl,
      caption: draft.caption,
      access_token: state.accessToken
    });

    const containerRes = await fetch(`https://graph.facebook.com/v20.0/${state.igUserId}/media`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: createBody
    });
    const containerData = await containerRes.json();

    if (!containerRes.ok || !containerData.id) {
      throw new Error(containerData?.error?.message || 'Failed creating media container.');
    }

    const publishBody = new URLSearchParams({
      creation_id: containerData.id,
      access_token: state.accessToken
    });

    const publishRes = await fetch(`https://graph.facebook.com/v20.0/${state.igUserId}/media_publish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: publishBody
    });
    const publishData = await publishRes.json();

    if (!publishRes.ok) {
      throw new Error(publishData?.error?.message || 'Publishing failed.');
    }

    state.drafts = state.drafts.filter((d) => d.id !== draft.id);
    await writeState(state);

    res.json({ ok: true, publishId: publishData.id });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

app.patch('/api/posts/:id', (_req, res) => {
  res.status(400).json({
    error: 'Instagram Graph API does not support editing already-published feed media. Edit draft before publishing instead.'
  });
});

app.post('/api/disconnect', async (_req, res) => {
  const state = await readState();
  state.accessToken = null;
  state.tokenType = null;
  state.expiresIn = null;
  state.connectedAt = null;
  state.igUserId = null;
  state.selectedPageId = null;
  state.pages = [];
  state.oauthState = null;
  await writeState(state);
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`NoReelsInsta MVP listening on http://localhost:${port}`);
});
