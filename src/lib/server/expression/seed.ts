import { createHash } from 'node:crypto';

/** Stable per-user daily seed for variability (70/30 rotation). */
export function expressionSeed(googleSub: string | undefined, profileUpdatedAt?: string): string {
  const sub = googleSub?.trim() || 'anon';
  const day = new Date().toISOString().slice(0, 10);
  const rev = profileUpdatedAt?.trim() || '0';
  return createHash('sha256').update(`${sub}\n${day}\n${rev}`).digest('hex').slice(0, 24);
}

export function seededUnit(seed: string, salt: string): number {
  const h = createHash('sha256').update(`${seed}:${salt}`).digest();
  return h[0]! / 255;
}

export function randomId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}
