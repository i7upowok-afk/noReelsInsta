import { decryptToken } from './crypto';
import { prisma } from './prisma';

const VERSION = process.env.META_API_VERSION || 'v20.0';
const GRAPH = `https://graph.facebook.com/${VERSION}`;

export function hasMetaCredentials() {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET && process.env.META_REDIRECT_URI);
}

export async function getStoredAccessToken() {
  const auth = await prisma.instagramAuth.findFirst({ orderBy: { updatedAt: 'desc' } });
  if (!auth) return null;
  return { token: decryptToken(auth.accessTokenEnc), auth };
}

export function buildOAuthUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID || '',
    redirect_uri: process.env.META_REDIRECT_URI || '',
    response_type: 'code',
    scope: 'instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,instagram_manage_comments,instagram_manage_insights',
    state
  });
  return `https://www.facebook.com/${VERSION}/dialog/oauth?${params.toString()}`;
}

export async function graphGet<T>(path: string, token: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${GRAPH}${path}${sep}access_token=${encodeURIComponent(token)}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || 'Graph GET failed');
  return json as T;
}

export async function graphPost<T>(path: string, body: URLSearchParams): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message || 'Graph POST failed');
  return json as T;
}
