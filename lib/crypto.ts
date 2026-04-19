import crypto from 'node:crypto';

function getKey() {
  const seed = process.env.TOKEN_ENCRYPTION_KEY || 'dev_only_change_me_please_32_chars';
  return crypto.createHash('sha256').update(seed).digest();
}

export function encryptToken(raw: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(raw, 'utf8'), cipher.final()]).toString('base64');
  return `${iv.toString('base64')}:${encrypted}`;
}

export function decryptToken(enc: string) {
  const [ivB64, payload] = enc.split(':');
  const decipher = crypto.createDecipheriv('aes-256-cbc', getKey(), Buffer.from(ivB64, 'base64'));
  const decrypted = Buffer.concat([decipher.update(Buffer.from(payload, 'base64')), decipher.final()]);
  return decrypted.toString('utf8');
}
