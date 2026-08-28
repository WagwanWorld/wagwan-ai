import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/server/wagwanAuth', () => ({
  extractWagwanUserId: vi.fn(),
  isWagwanAuthConfigured: vi.fn(() => true),
}));

import { creatorInstagramUsername } from '../src/lib/server/creatorAuth';

describe('creatorInstagramUsername', () => {
  it('normalizes the linked creator Instagram identity used for invite ownership checks', () => {
    expect(
      creatorInstagramUsername({
        instagramIdentity: { username: 'https://www.instagram.com/Test.Creator/' },
      }),
    ).toBe('test.creator');
  });

  it('returns null when the authenticated profile has no Instagram identity', () => {
    expect(creatorInstagramUsername({})).toBeNull();
  });
});
