import { describe, expect, it } from 'vitest';
import {
  getProfileInstagramUsername,
  normalizeCreatorInstagramUsername,
} from '../src/lib/server/creatorIdentity';

describe('creator identity helpers', () => {
  it('normalizes profile Instagram usernames for invite ownership checks', () => {
    expect(normalizeCreatorInstagramUsername('@Creator.Name')).toBe('creator.name');
    expect(
      getProfileInstagramUsername({
        instagramIdentity: { username: '  @Creator_Name  ' },
      }),
    ).toBe('creator_name');
  });

  it('returns an empty username when Instagram is not linked', () => {
    expect(getProfileInstagramUsername({})).toBe('');
    expect(getProfileInstagramUsername({ instagramIdentity: {} })).toBe('');
  });
});
