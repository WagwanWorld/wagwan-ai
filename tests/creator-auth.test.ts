import { describe, expect, it, vi } from 'vitest';
import {
  normalizeCreatorInstagramUsername,
  requireAuthenticatedCreator,
} from '../src/lib/server/creatorAuth';

vi.mock('$lib/server/wagwanAuth', () => ({
  extractWagwanUserId: () => 'wagwan-user-1',
  isWagwanAuthConfigured: () => true,
}));

function makeProfileClient(row: Record<string, unknown> | null) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: row, error: null })),
        })),
      })),
    })),
  };
}

describe('creator auth', () => {
  it('normalizes stored Instagram usernames for invite ownership checks', () => {
    expect(normalizeCreatorInstagramUsername('@Creator.Name')).toBe('creator.name');
    expect(normalizeCreatorInstagramUsername('https://www.instagram.com/Creator.Name/reels')).toBe(
      'creator.name',
    );
    expect(normalizeCreatorInstagramUsername('bad handle!')).toBeNull();
  });

  it('resolves creator identity from the linked Wagwan token profile', async () => {
    const sb = makeProfileClient({
      google_sub: 'ig:user:creator.name',
      profile_data: {
        instagramIdentity: {
          username: 'Creator.Name',
        },
      },
      identity_graph: {},
    });

    const creator = await requireAuthenticatedCreator(
      new Request('https://example.test'),
      sb as never,
    );

    expect(creator.googleSub).toBe('ig:user:creator.name');
    expect(creator.wagwanUserId).toBe('wagwan-user-1');
    expect(creator.instagramUsername).toBe('creator.name');
  });
});
