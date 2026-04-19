import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const drafts = await prisma.draft.findMany({ orderBy: { createdAt: 'desc' } });
  return NextResponse.json(drafts);
}

export async function POST(req: NextRequest) {
  try {
    const { caption, mediaUrl, previewUrl } = await req.json();
    if (!caption) return NextResponse.json({ error: 'Caption is required.' }, { status: 400 });

    const draft = await prisma.draft.create({
      data: {
        caption,
        mediaUrl: mediaUrl || previewUrl || '',
        previewUrl: previewUrl || null
      }
    });

    return NextResponse.json(draft);
  } catch {
    return NextResponse.json({ error: 'Failed to save draft.' }, { status: 500 });
  }
}
