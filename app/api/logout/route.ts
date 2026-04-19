import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST() {
  await prisma.instagramAuth.deleteMany();
  return NextResponse.json({ ok: true });
}
