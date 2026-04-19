import { NextRequest, NextResponse } from 'next/server';
import { createDraft, listDrafts } from '@/lib/store';

export async function GET() {
  const drafts = await listDrafts();
  return NextResponse.json(drafts);
}

export async function POST(req: NextRequest) {
  try {
    const { caption, mediaUrl, previewUrl } = await req.json();
    if (!caption) return NextResponse.json({ error: 'Caption is required.' }, { status: 400 });

    const draft = await createDraft({
      caption,
      mediaUrl: mediaUrl || previewUrl || '',
      previewUrl: previewUrl || null
    });

    return NextResponse.json(draft);
  } catch {
    return NextResponse.json({ error: 'Failed to save draft.' }, { status: 500 });
  }
}
