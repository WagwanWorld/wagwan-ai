import { describe, expect, it, vi } from 'vitest';
import { resolveAuthenticatedCreatorProfile } from '../src/lib/server/creatorAuthCore';

function request() {
  return new Request('https://example.com/api/creator/brand-signals', {
    headers: { Authorization: 'Bearer token' },
  });
}

describe('resolveAuthenticatedCreatorProfile', () => {
  it('rejects requests without a valid Wagwan token', async () => {
    const result = await resolveAuthenticatedCreatorProfile(request(), null, {
      isWagwanAuthConfigured: () => true,
      extractWagwanUserId: () => null,
      getProfileByWagwanId: vi.fn(),
    });

    expect(result).toEqual({ ok: false, status: 401, error: 'invalid_or_missing_token' });
  });

  it('rejects unlinked Wagwan users', async () => {
    const result = await resolveAuthenticatedCreatorProfile(request(), null, {
      isWagwanAuthConfigured: () => true,
      extractWagwanUserId: () => 'wagwan-user-1',
      getProfileByWagwanId: vi.fn().mockResolvedValue(null),
    });

    expect(result).toEqual({ ok: false, status: 403, error: 'creator_profile_not_linked' });
  });

  it('rejects caller-supplied googleSub mismatches', async () => {
    const result = await resolveAuthenticatedCreatorProfile(request(), 'attacker-sub', {
      isWagwanAuthConfigured: () => true,
      extractWagwanUserId: () => 'wagwan-user-1',
      getProfileByWagwanId: vi.fn().mockResolvedValue({ google_sub: 'creator-sub' }),
    });

    expect(result).toEqual({ ok: false, status: 403, error: 'google_sub_mismatch' });
  });

  it('resolves googleSub from the linked profile instead of the request body', async () => {
    const result = await resolveAuthenticatedCreatorProfile(request(), undefined, {
      isWagwanAuthConfigured: () => true,
      extractWagwanUserId: () => 'wagwan-user-1',
      getProfileByWagwanId: vi.fn().mockResolvedValue({ google_sub: 'creator-sub' }),
    });

    expect(result).toEqual({
      ok: true,
      wagwanUserId: 'wagwan-user-1',
      googleSub: 'creator-sub',
      profile: { google_sub: 'creator-sub' },
    });
  });
});
