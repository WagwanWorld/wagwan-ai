import { describe, expect, it } from 'vitest';
import {
  creatorInstagramUsername,
  normalizeCreatorRosterHandle,
} from '../src/lib/server/creatorAuth';

describe('creator auth identity helpers', () => {
  it('normalizes linked creator Instagram usernames', () => {
    expect(
      creatorInstagramUsername({
        instagramIdentity: {
          username: '@Creator.Name',
        },
      }),
    ).toBe('creator.name');
  });

  it('normalizes roster handles before invite ownership checks', () => {
    expect(normalizeCreatorRosterHandle('https://www.instagram.com/Creator_Name/')).toBe(
      'creator_name',
    );
  });

  it('rejects missing or malformed creator handles', () => {
    expect(creatorInstagramUsername({ instagramIdentity: {} })).toBeNull();
    expect(normalizeCreatorRosterHandle('bad handle!')).toBeNull();
  });
});
