import { describe, expect, it } from 'vitest';
import { extractProfileInstagramUsername } from '../src/lib/server/creatorAuthUtils';

describe('extractProfileInstagramUsername', () => {
  it('normalizes stored Instagram usernames before invite ownership checks', () => {
    expect(
      extractProfileInstagramUsername({
        instagramIdentity: { username: '@Creator.Name' },
      }),
    ).toBe('creator.name');

    expect(
      extractProfileInstagramUsername({
        instagramIdentity: { username: 'https://www.instagram.com/Creator_Name/' },
      }),
    ).toBe('creator_name');
  });

  it('rejects missing or invalid Instagram identity data', () => {
    expect(extractProfileInstagramUsername({})).toBeNull();
    expect(extractProfileInstagramUsername({ instagramIdentity: null })).toBeNull();
    expect(
      extractProfileInstagramUsername({ instagramIdentity: { username: 'bad handle!' } }),
    ).toBeNull();
  });
});
