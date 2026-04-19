import { NextRequest, NextResponse } from 'next/server';
import { encryptToken } from '@/lib/crypto';
import { saveAuth } from '@/lib/store';
import { graphGet, hasMetaCredentials } from '@/lib/meta';

const VERSION = process.env.META_API_VERSION || 'v20.0';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code');
  const state = req.nextUrl.searchParams.get('state');
  const cookieState = req.cookies.get('oauth_state')?.value;

  if (!hasMetaCredentials()) return NextResponse.redirect(new URL('/dashboard?mock=1', req.url));
  if (!code || !state || state !== cookieState) return NextResponse.redirect(new URL('/dashboard?error=oauth_state', req.url));

  try {
    const params = new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      redirect_uri: process.env.META_REDIRECT_URI!,
      code
    });

    const tokenRes = await fetch(`https://graph.facebook.com/${VERSION}/oauth/access_token?${params.toString()}`);
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(tokenJson?.error?.message || 'OAuth token exchange failed');
    }

    const me = await graphGet<{ id: string; name?: string }>(`/me?fields=id,name`, tokenJson.access_token);

    await saveAuth({
        instagramUserId: me.id,
        username: me.name,
        accessTokenEnc: encryptToken(tokenJson.access_token),
        tokenType: tokenJson.token_type || 'bearer',
        expiresAt: tokenJson.expires_in ? new Date(Date.now() + tokenJson.expires_in * 1000) : null
      }
    );

    const res = NextResponse.redirect(new URL('/dashboard?connected=1', req.url));
    res.cookies.delete('oauth_state');
    return res;
  } catch (e: any) {
    return NextResponse.redirect(new URL(`/dashboard?error=${encodeURIComponent(e.message)}`, req.url));
  }
}
