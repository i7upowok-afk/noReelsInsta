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
      displayName: null,
      profilePictureUrl: null,
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
    if (raw.length > 10_000_000) throw new Error('Request body too large');
  }
  if (!raw) return {};
  return JSON.parse(raw);
}

function extractMeta(html, property) {
  const rgx = new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i');
  const match = html.match(rgx);
  return match?.[1] || null;
}

function extractTitleName(title) {
  if (!title) return null;
  return title.replace(/\s*\(@[^)]+\)\s*•\s*Instagram.*/i, '').trim();
}

async function fetchPublicInstagramProfile(username) {
  const response = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (NoReelsInsta/1.0)'
    }
  });

  if (!response.ok) {
    throw new Error('Could not fetch Instagram public profile page.');
  }

  const html = await response.text();
  const ogTitle = extractMeta(html, 'og:title');
  const ogImage = extractMeta(html, 'og:image');

  return {
    displayName: extractTitleName(ogTitle) || username,
    profilePictureUrl: ogImage
  };
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/connect-instagram' && req.method === 'POST') {
    try {
      const body = await parseBody(req);
      const username = extractInstagramUsername(body.instagramUrl || '');
      if (!username) {
        return sendJson(res, 400, { error: 'Paste a valid Instagram profile URL (example: https://instagram.com/your_username).' });
      }

      let profile;
      try {
        profile = await fetchPublicInstagramProfile(username);
      } catch {
        profile = {
          displayName: username,
          profilePictureUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=111827&color=ffffff`
        };
      }

      const state = await readState();
      state.instagramUrl = `https://instagram.com/${username}`;
      state.instagramUsername = username;
      state.connectedAt = new Date().toISOString();
      state.displayName = profile.displayName;
      state.profilePictureUrl = profile.profilePictureUrl;
      await writeState(state);

      return sendJson(res, 200, {
        ok: true,
        instagramUsername: username,
        displayName: profile.displayName,
        profilePictureUrl: profile.profilePictureUrl
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
      displayName: state.displayName,
      profilePictureUrl: state.profilePictureUrl,
      draftCount: state.drafts.length
    });
  }

  if (pathname === '/api/disconnect' && req.method === 'POST') {
    const state = await readState();
    state.connectedAt = null;
    state.instagramUrl = null;
    state.instagramUsername = null;
    state.displayName = null;
    state.profilePictureUrl = null;
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
      if (!body.caption || !body.imageDataUrl) {
        return sendJson(res, 400, { error: 'caption and image file are required.' });
      }

      const state = await readState();
      const draft = {
        id: randomUUID(),
        caption: String(body.caption),
        imageDataUrl: String(body.imageDataUrl),
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
        imageDataUrl: body.imageDataUrl ?? state.drafts[idx].imageDataUrl,
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
    return sendJson(res, 200, []);
  }

  const publishMatch = pathname.match(/^\/api\/publish\/([a-zA-Z0-9-]+)$/);
  if (publishMatch && req.method === 'POST') {
    return sendJson(res, 400, {
      error: 'Publishing is disabled in URL-only connection mode. Add real Instagram API auth flow in next step if needed.'
    });
  }

  if (pathname.startsWith('/api/')) {
    return sendJson(res, 404, { error: 'Not found' });
  }

  return false;
}

async function serveStatic(res, pathname) {
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

    await serveStatic(res, pathname);
  } catch (e) {
    sendJson(res, 500, { error: e.message || 'Internal error' });
  }
});

server.listen(port, () => {
  console.log(`NoReelsInsta listening on http://localhost:${port}`);
});
