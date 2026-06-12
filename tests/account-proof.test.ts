import { describe, expect, it } from 'vitest';
import {
  normalizeInstagramUsername,
  signInstagramAccountProof,
  verifyInstagramAccountProof,
} from '../src/lib/server/marketplace/accountProof';

describe('Instagram account proof', () => {
  const secret = 'test-cookie-secret';
  const now = new Date('2026-05-28T11:00:00Z').getTime();

  it('round-trips a signed Instagram account proof', () => {
    const proof = signInstagramAccountProof(
      { igUserId: '17841400000000000', username: '@Creator.Name' },
      secret,
      now,
    );

    expect(verifyInstagramAccountProof(proof, secret, now)).toMatchObject({
      igUserId: '17841400000000000',
      username: 'creator.name',
    });
  });

  it('rejects tampered signatures and expired proofs', () => {
    const proof = signInstagramAccountProof({ igUserId: 'ig-1', username: 'creator' }, secret, now);

    expect(verifyInstagramAccountProof(`${proof}x`, secret, now)).toBeNull();
    expect(verifyInstagramAccountProof(proof, 'wrong-secret', now)).toBeNull();
    expect(verifyInstagramAccountProof(proof, secret, now + 31 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it('normalizes Instagram usernames before comparison', () => {
    expect(normalizeInstagramUsername(' @Mixed.Case ')).toBe('mixed.case');
  });
});
