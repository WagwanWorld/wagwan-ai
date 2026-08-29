import { describe, expect, it } from 'vitest';
import { getProfileInstagramUsername } from '../src/lib/server/creatorIdentity';

describe('getProfileInstagramUsername', () => {
  it('normalizes the linked creator Instagram username', () => {
    expect(
      getProfileInstagramUsername({
        instagramIdentity: {
          username: 'https://www.instagram.com/Fuzone.Creator/',
        },
      }),
    ).toBe('fuzone.creator');
  });

  it('returns null when the profile has no usable Instagram identity', () => {
    expect(getProfileInstagramUsername({})).toBeNull();
    expect(
      getProfileInstagramUsername({ instagramIdentity: { username: 'bad handle!' } }),
    ).toBeNull();
  });
});
