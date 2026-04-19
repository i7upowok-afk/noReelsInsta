import { NextResponse } from 'next/server';
import { hasMetaCredentials } from '@/lib/meta';

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: hasMetaCredentials() ? 'meta' : 'mock',
    timestamp: new Date().toISOString()
  });
}
