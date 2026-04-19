import { NextRequest, NextResponse } from 'next/server';
import { getStoredAccessToken, graphPost, hasMetaCredentials } from '@/lib/meta';

export async function POST(req: NextRequest) {
  const { caption, mediaUrl } = await req.json();

  if (!caption || !mediaUrl) {
    return NextResponse.json({ error: 'caption and mediaUrl are required.' }, { status: 400 });
  }

  if (!hasMetaCredentials()) {
    return NextResponse.json({ ok: true, mock: true, id: `mock_${Date.now()}` });
  }

  try {
    const tokenInfo = await getStoredAccessToken();
    if (!tokenInfo?.auth.instagramUserId) throw new Error('No connected account.');

    const createContainer = await graphPost<{ id: string }>(
      `/${tokenInfo.auth.instagramUserId}/media`,
      new URLSearchParams({ image_url: mediaUrl, caption, access_token: tokenInfo.token })
    );

    const publish = await graphPost<{ id: string }>(
      `/${tokenInfo.auth.instagramUserId}/media_publish`,
      new URLSearchParams({ creation_id: createContainer.id, access_token: tokenInfo.token })
    );

    return NextResponse.json({ ok: true, id: publish.id, mock: false });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
