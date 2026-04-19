import { prisma } from '@/lib/prisma';
import fs from 'node:fs/promises';
import path from 'node:path';

const dbEnabled = Boolean(process.env.DATABASE_URL);
const filePath = path.join(process.cwd(), 'data', 'mvp-store.json');

type FileState = {
  auth: any | null;
  drafts: any[];
};

async function readFileState(): Promise<FileState> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { auth: null, drafts: [] };
  }
}

async function writeFileState(state: FileState) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(state, null, 2));
}

export async function saveAuth(data: {
  instagramUserId?: string | null;
  username?: string | null;
  accessTokenEnc: string;
  tokenType?: string | null;
  expiresAt?: Date | null;
}) {
  if (dbEnabled) {
    return prisma.instagramAuth.create({ data });
  }

  const state = await readFileState();
  state.auth = {
    id: 'file-auth',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...data
  };
  await writeFileState(state);
  return state.auth;
}

export async function getLatestAuth() {
  if (dbEnabled) {
    return prisma.instagramAuth.findFirst({ orderBy: { updatedAt: 'desc' } });
  }
  const state = await readFileState();
  return state.auth;
}

export async function clearAuth() {
  if (dbEnabled) {
    await prisma.instagramAuth.deleteMany();
    return;
  }
  const state = await readFileState();
  state.auth = null;
  await writeFileState(state);
}

export async function listDrafts() {
  if (dbEnabled) {
    return prisma.draft.findMany({ orderBy: { createdAt: 'desc' } });
  }
  const state = await readFileState();
  return state.drafts;
}

export async function createDraft(data: { caption: string; mediaUrl: string; previewUrl?: string | null }) {
  if (dbEnabled) {
    return prisma.draft.create({ data });
  }
  const state = await readFileState();
  const draft = {
    id: `draft_${Date.now()}`,
    ...data,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  state.drafts.unshift(draft);
  await writeFileState(state);
  return draft;
}
