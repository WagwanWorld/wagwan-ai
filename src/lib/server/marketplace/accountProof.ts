import { createHmac, timingSafeEqual } from 'node:crypto';

export const IG_ACCOUNT_PROOF_COOKIE = 'wagwan_ig_account_proof';
export const IG_ACCOUNT_PROOF_MAX_AGE_SEC = 30 * 24 * 60 * 60;

export type InstagramAccountProof = {
  igUserId: string;
  username: string;
  exp: number;
};

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function normalizeInstagramUsername(username: string | null | undefined): string {
  return (username ?? '').trim().replace(/^@/, '').toLowerCase();
}

export function signInstagramAccountProof(
  input: { igUserId?: string | null; username?: string | null },
  secret: string,
  nowMs = Date.now(),
): string {
  const igUserId = (input.igUserId ?? '').trim();
  const username = normalizeInstagramUsername(input.username);
  if (!igUserId || !username) {
    throw new Error('instagram_proof_missing_identity');
  }
  const payload = base64UrlJson({
    igUserId,
    username,
    exp: Math.floor(nowMs / 1000) + IG_ACCOUNT_PROOF_MAX_AGE_SEC,
  });
  return `${payload}.${signPayload(payload, secret)}`;
}

export function verifyInstagramAccountProof(
  proof: string | null | undefined,
  secret: string,
  nowMs = Date.now(),
): InstagramAccountProof | null {
  const raw = (proof ?? '').trim();
  const dot = raw.lastIndexOf('.');
  if (!raw || dot <= 0) return null;

  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expected = signPayload(payload, secret);
  if (!safeEqual(sig, expected)) return null;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<InstagramAccountProof>;
    const exp = Number(decoded.exp);
    const igUserId = typeof decoded.igUserId === 'string' ? decoded.igUserId.trim() : '';
    const username = normalizeInstagramUsername(decoded.username);
    if (!igUserId || !username || !Number.isFinite(exp)) return null;
    if (exp < Math.floor(nowMs / 1000)) return null;
    return { igUserId, username, exp };
  } catch {
    return null;
  }
}
