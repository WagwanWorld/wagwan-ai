import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertCreatorAccess, instagramUsernameFromProfile } from '../src/lib/server/creatorAuth';
import { extractWagwanUserId, isWagwanAuthConfigured } from '../src/lib/server/wagwanAuth';

vi.mock('../src/lib/server/wagwanAuth', () => ({
  extractWagwanUserId: vi.fn(),
  isWagwanAuthConfigured: vi.fn(),
}));

function mockSupabaseProfile(profile: Record<string, unknown> | null, dbError: Error | null = null) {
  const query = {
    from: vi.fn(() => query),
    select: vi.fn(() => query),
    eq: vi.fn(() => query),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error: dbError }),
  };
  return query;
}

describe('creator auth', () => {
  beforeEach(() => {
    vi.mocked(isWagwanAuthConfigured).mockReturnValue(true);
    vi.mocked(extractWagwanUserId).mockReturnValue('wagwan-user-1');
  });

  it('derives creator identity from the bearer-token linked profile', async () => {
    const sb = mockSupabaseProfile({
      google_sub: 'creator-sub-1',
      profile_data: { instagramIdentity: { username: '@Creator.Handle' } },
    });

    const creator = await assertCreatorAccess(new Request('https://example.com'), sb as never);

    expect(sb.eq).toHaveBeenCalledWith('wagwan_user_id', 'wagwan-user-1');
    expect(creator.googleSub).toBe('creator-sub-1');
    expect(creator.instagramUsername).toBe('creator.handle');
  });

  it('rejects missing or invalid bearer tokens before querying profiles', async () => {
    vi.mocked(extractWagwanUserId).mockReturnValue(null);
    const sb = mockSupabaseProfile({
      google_sub: 'creator-sub-1',
      profile_data: {},
    });

    await expect(assertCreatorAccess(new Request('https://example.com'), sb as never)).rejects.toMatchObject({
      status: 401,
    });
    expect(sb.from).not.toHaveBeenCalled();
  });

  it('rejects valid tokens that are not linked to a creator profile', async () => {
    const sb = mockSupabaseProfile(null);

    await expect(assertCreatorAccess(new Request('https://example.com'), sb as never)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('normalizes instagram usernames from profile data', () => {
    expect(instagramUsernameFromProfile({ instagramIdentity: { username: '@Riya.Hundi ' } })).toBe(
      'riya.hundi',
    );
    expect(instagramUsernameFromProfile({ instagramIdentity: {} })).toBeNull();
  });
});
