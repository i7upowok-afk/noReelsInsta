import { NextResponse } from 'next/server';
import { getStoredAccessToken, graphGet, hasMetaCredentials } from '@/lib/meta';

export async function GET() {
  if (!hasMetaCredentials()) {
    return NextResponse.json([{ id: 'c1', text: 'Mock comment from API fallback' }]);
  }

  try {
    const tokenInfo = await getStoredAccessToken();
    if (!tokenInfo?.auth.instagramUserId) return NextResponse.json([]);

    const media = await graphGet<{ data: { id: string }[] }>(`/${tokenInfo.auth.instagramUserId}/media?fields=id&limit=5`, tokenInfo.token);
    const comments: any[] = [];

    for (const m of media.data || []) {
      const c = await graphGet<{ data: any[] }>(`/${m.id}/comments?fields=id,text,username,timestamp`, tokenInfo.token);
      comments.push(...(c.data || []));
    }

    return NextResponse.json(comments);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 });
  }
}
