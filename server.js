import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(process.env.PORT || 3000);

const dataDir = path.join(__dirname, 'data');
const stateFile = path.join(dataDir, 'state.json');
const publicDir = path.join(__dirname, 'public');

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8'
};

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': mime['.json'] });
  res.end(JSON.stringify(data));
}

function sendText(res, status, text) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end(text);
}

async function readState() {
  try {
    return JSON.parse(await readFile(stateFile, 'utf8'));
  } catch {
    return {
      connectedAt: null,
      instagramUrl: null,
      instagramUsername: null,
      accessToken: null,
      igUserId: null,
      drafts: []
    };
  }
}

async function writeState(state) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2));
}

function extractInstagramUsername(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (!url.hostname.includes('instagram.com')) return null;

    const seg = url.pathname.split('/').filter(Boolean)[0];
    if (!seg) return null;

    const reserved = new Set(['p', 'reel', 'reels', 'stories', 'explore']);
    if (reserved.has(seg.toLowerCase())) return null;

    return seg;
  } catch {
    return null;
  }
}

async function parseBody(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 1_000_000) throw new Error('Request body too large');
  }
  if (!raw) return {};
  return JSON.parse(raw);
}

async function graphFetch(pathname, token) {
  const sep = pathname.includes('?') ? '&' : '?';
  const url = `https://graph.facebook.com/v20.0${pathname}${sep}access_token=${encodeURIComponent(token)}`;
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || `Graph API failed (${response.status})`);
  }

  return data;
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/config' && req.method === 'GET') {
    return sendJson(res, 200, {
      supportsPublishing: true,
      publishNeeds: ['instagram profile URL', 'Instagram Graph access token', 'Instagram User ID']
    });
  }

  if (pathname === '/api/connect-instagram' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const username = extractInstagramUsername(body.instagramUrl || '');
      if (!username) {
        return sendJson(res, 400, { error: 'Paste a valid Instagram profile URL (example: https://instagram.com/your_username).' });
      }

      const state = await readState();
      state.instagramUrl = body.instagramUrl;
      state.instagramUsername = username;
      state.connectedAt = new Date().toISOString();
      state.accessToken = body.accessToken || state.accessToken || null;
      state.igUserId = body.igUserId || state.igUserId || null;
      await writeState(state);

      return sendJson(res, 200, {
        ok: true,
        instagramUsername: username,
        publishingReady: Boolean(state.accessToken && state.igUserId)
      });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  if (pathname === '/api/session' && req.method === 'GET') {
    const state = await readState();
    return sendJson(res, 200, {
      connected: Boolean(state.instagramUrl),
      connectedAt: state.connectedAt,
      instagramUrl: state.instagramUrl,
      instagramUsername: state.instagramUsername,
      hasAccessToken: Boolean(state.accessToken),
      igUserId: state.igUserId,
      publishingReady: Boolean(state.accessToken && state.igUserId),
      draftCount: state.drafts.length
    });
  }

  if (pathname === '/api/connection-check' && req.method === 'GET') {
    const state = await readState();
    if (!state.accessToken || !state.igUserId) {
      return sendJson(res, 400, { ok: false, error: 'Add access token and Instagram User ID to verify API publishing access.' });
    }

    try {
      const igAccount = await graphFetch(`/${state.igUserId}?fields=id,username,account_type`, state.accessToken);
      return sendJson(res, 200, { ok: true, igAccount });
    } catch (e) {
      return sendJson(res, 400, { ok: false, error: e.message });
    }
  }

  if (pathname === '/api/disconnect' && req.method === 'POST') {
    const state = await readState();
    state.connectedAt = null;
    state.instagramUrl = null;
    state.instagramUsername = null;
    state.accessToken = null;
    state.igUserId = null;
    await writeState(state);
    return sendJson(res, 200, { ok: true });
  }

  if (pathname === '/api/drafts' && req.method === 'GET') {
    const state = await readState();
    return sendJson(res, 200, state.drafts);
  }

  if (pathname === '/api/drafts' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      if (!body.caption || !body.imageUrl) {
        return sendJson(res, 400, { error: 'caption and imageUrl are required.' });
      }

      const state = await readState();
      const draft = {
        id: randomUUID(),
        caption: String(body.caption),
        imageUrl: String(body.imageUrl),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      state.drafts.unshift(draft);
      await writeState(state);
      return sendJson(res, 201, draft);
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  const draftIdMatch = pathname.match(/^\/api\/drafts\/([a-zA-Z0-9-]+)$/);
  if (draftIdMatch && req.method === 'PUT') {
    try {
      const body = await parseBody(req);
      const state = await readState();
      const idx = state.drafts.findIndex((d) => d.id === draftIdMatch[1]);
      if (idx === -1) return sendJson(res, 404, { error: 'Draft not found.' });

      state.drafts[idx] = {
        ...state.drafts[idx],
        caption: body.caption ?? state.drafts[idx].caption,
        imageUrl: body.imageUrl ?? state.drafts[idx].imageUrl,
        updatedAt: new Date().toISOString()
      };
      await writeState(state);
      return sendJson(res, 200, state.drafts[idx]);
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  if (draftIdMatch && req.method === 'DELETE') {
    const state = await readState();
    state.drafts = state.drafts.filter((d) => d.id !== draftIdMatch[1]);
    await writeState(state);
    res.writeHead(204);
    return res.end();
  }

  if (pathname === '/api/posts' && req.method === 'GET') {
    const state = await readState();
    if (!state.accessToken || !state.igUserId) {
      return sendJson(res, 400, { error: 'To list published posts, add access token + Instagram User ID in the connect form.' });
    }

    try {
      const fields = 'id,caption,media_type,media_url,permalink,timestamp';
      const data = await graphFetch(`/${state.igUserId}/media?fields=${fields}`, state.accessToken);
      return sendJson(res, 200, data.data || []);
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  const publishMatch = pathname.match(/^\/api\/publish\/([a-zA-Z0-9-]+)$/);
  if (publishMatch && req.method === 'POST') {
    const state = await readState();
    const draft = state.drafts.find((d) => d.id === publishMatch[1]);
    if (!draft) return sendJson(res, 404, { error: 'Draft not found.' });
    if (!state.accessToken || !state.igUserId) {
      return sendJson(res, 400, { error: 'Publishing requires access token + Instagram User ID in the connect form.' });
    }

    try {
      const createBody = new URLSearchParams({
        image_url: draft.imageUrl,
        caption: draft.caption,
        access_token: state.accessToken
      });

      const createRes = await fetch(`https://graph.facebook.com/v20.0/${state.igUserId}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: createBody
      });
      const createData = await createRes.json();
      if (!createRes.ok || !createData.id) {
        throw new Error(createData?.error?.message || 'Failed to create media container.');
      }

      const publishBody = new URLSearchParams({
        creation_id: createData.id,
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

      return sendJson(res, 200, { ok: true, publishId: publishData.id });
    } catch (e) {
      return sendJson(res, 400, { error: e.message });
    }
  }

  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'Not found' });
  }

  return false;
}

async function serveStatic(req, res, pathname) {
  let filePath = path.join(publicDir, pathname === '/' ? 'index.html' : pathname);
  if (!filePath.startsWith(publicDir)) {
    return sendText(res, 403, 'Forbidden');
  }

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = path.join(filePath, 'index.html');
    const ext = path.extname(filePath);
    const body = await readFile(filePath);
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(body);
  } catch {
    sendText(res, 404, 'Not found');
  }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const pathname = url.pathname;

    const apiHandled = await handleApi(req, res, pathname);
    if (apiHandled !== false) return;

    await serveStatic(req, res, pathname);
  } catch (e) {
    sendJson(res, 500, { error: e.message || 'Internal error' });
  }
});

server.listen(port, () => {
  console.log(`NoReelsInsta listening on http://localhost:${port}`);
});
