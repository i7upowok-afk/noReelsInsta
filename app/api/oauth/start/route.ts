import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { buildOAuthUrl, hasMetaCredentials } from '@/lib/meta';

export async function GET() {
  const state = crypto.randomUUID();

  if (!hasMetaCredentials()) {
    return NextResponse.json({ url: '/dashboard?mock_oauth=1' });
  }

  const url = buildOAuthUrl(state);
  const res = NextResponse.json({ url });
  res.cookies.set('oauth_state', state, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/' });
  return res;
}
