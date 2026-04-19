import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { hasMetaCredentials } from '@/lib/meta';

export async function GET() {
  const auth = await prisma.instagramAuth.findFirst({ orderBy: { updatedAt: 'desc' } });
  const connected = Boolean(auth);

  return NextResponse.json({
    connected,
    username: auth?.username || null,
    mock: !hasMetaCredentials() || !connected
  });
}
