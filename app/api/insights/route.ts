import { NextResponse } from 'next/server';
import { getStoredAccessToken, graphGet, hasMetaCredentials } from '@/lib/meta';

export async function GET() {
  if (!hasMetaCredentials()) {
    return NextResponse.json([
      { name: 'impressions', value: 1200 },
      { name: 'reach', value: 800 }
    ]);
  }

  try {
    const tokenInfo = await getStoredAccessToken();
    if (!tokenInfo?.auth.instagramUserId) return NextResponse.json([]);

    const result = await graphGet<{ data: any[] }>(
      `/${tokenInfo.auth.instagramUserId}/insights?metric=impressions,reach,profile_views&period=day`,
      tokenInfo.token
    );

    return NextResponse.json(result.data || []);
  } catch {
    return NextResponse.json([]);
  }
}
