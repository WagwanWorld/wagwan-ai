import { describe, it, expect } from 'vitest';
import { createHmac } from 'node:crypto';

// Inline the logic to test without SvelteKit env imports
const TEST_SECRET = 'test-cookie-secret-for-unit-tests';
const MAX_AGE_SEC = 600;

function signOAuthState(nonce: string): string {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_SEC;
  const payload = `${nonce}:${exp}`;
  const sig = createHmac('sha256', TEST_SECRET).update(payload).digest('hex');
  return `${payload}:${sig}`;
}

function verifyOAuthState(state: string): string | null {
  if (!state) return null;
  const lastColon = state.lastIndexOf(':');
  if (lastColon <= 0) return null;
  const payload = state.slice(0, lastColon);
  const sig = state.slice(lastColon + 1);
  const parts = payload.split(':');
  if (parts.length !== 2) return null;
  const [nonce, expStr] = parts;
  const exp = parseInt(expStr, 10);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  const expected = createHmac('sha256', TEST_SECRET).update(payload).digest('hex');
  if (sig.length !== expected.length || sig !== expected) return null;
  return nonce;
}

describe('OAuth state signing', () => {
  it('round-trips: sign then verify returns the original nonce', () => {
    const nonce = 'abc-123-def';
    const signed = signOAuthState(nonce);
    expect(verifyOAuthState(signed)).toBe(nonce);
  });

  it('rejects tampered state', () => {
    const signed = signOAuthState('my-nonce');
    const tampered = signed.replace('my-nonce', 'evil-nonce');
    expect(verifyOAuthState(tampered)).toBeNull();
  });

  it('rejects expired state', () => {
    const nonce = 'expired-nonce';
    const exp = Math.floor(Date.now() / 1000) - 10; // 10 seconds ago
    const payload = `${nonce}:${exp}`;
    const sig = createHmac('sha256', TEST_SECRET).update(payload).digest('hex');
    expect(verifyOAuthState(`${payload}:${sig}`)).toBeNull();
  });

  it('rejects empty or malformed strings', () => {
    expect(verifyOAuthState('')).toBeNull();
    expect(verifyOAuthState('just-a-string')).toBeNull();
    expect(verifyOAuthState('a:b:c:d')).toBeNull();
  });

  it('rejects truncated signature', () => {
    const signed = signOAuthState('nonce');
    const truncated = signed.slice(0, -5);
    expect(verifyOAuthState(truncated)).toBeNull();
  });
});
