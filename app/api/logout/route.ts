import { NextResponse } from 'next/server';
import { clearAuth } from '@/lib/store';

export async function POST() {
  await clearAuth();
  return NextResponse.json({ ok: true });
}
