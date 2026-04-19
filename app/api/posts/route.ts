import { NextResponse } from 'next/server';
import { getStoredAccessToken, graphGet, hasMetaCredentials } from '@/lib/meta';

export async function GET() {
  if (!hasMetaCredentials()) {
    return NextResponse.json([
      { id: 'mock1', caption: 'Mock published post', permalink: '#' }
    ]);
  }

  try {
    const tokenInfo = await getStoredAccessToken();
    if (!tokenInfo?.auth.instagramUserId) return NextResponse.json([]);

    const result = await graphGet<{ data: any[] }>(
      `/${tokenInfo.auth.instagramUserId}/media?fields=id,caption,permalink,timestamp,media_type`,
      tokenInfo.token
    );
    return NextResponse.json(result.data || []);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
