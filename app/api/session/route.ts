import { NextResponse } from 'next/server';
import { getLatestAuth } from '@/lib/store';
import { hasMetaCredentials } from '@/lib/meta';

export async function GET() {
  const auth = await getLatestAuth();
  const connected = Boolean(auth);

  return NextResponse.json({
    connected,
    username: auth?.username || null,
    mock: !hasMetaCredentials() || !connected
  });
}
