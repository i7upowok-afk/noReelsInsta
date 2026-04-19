import { NextRequest, NextResponse } from 'next/server';
import { getStoredAccessToken, graphPost, hasMetaCredentials } from '@/lib/meta';

export async function POST(req: NextRequest) {
  const { commentId, text } = await req.json();
  if (!commentId || !text) return NextResponse.json({ error: 'commentId and text are required.' }, { status: 400 });

  if (!hasMetaCredentials()) {
    return NextResponse.json({ ok: true, mock: true });
  }

  try {
    const tokenInfo = await getStoredAccessToken();
    if (!tokenInfo) throw new Error('No connected account.');

    await graphPost(`/${commentId}/replies`, new URLSearchParams({ message: text, access_token: tokenInfo.token }));
    return NextResponse.json({ ok: true, mock: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
