import { describe, expect, it } from 'vitest';
import {
  normalizeInstagramUsername,
  profileInstagramUsername,
} from '../src/lib/server/creatorIdentity';

describe('creator auth utilities', () => {
  it('normalizes Instagram usernames from handles and URLs', () => {
    expect(normalizeInstagramUsername('@Creator.Name')).toBe('creator.name');
    expect(normalizeInstagramUsername('https://www.instagram.com/Creator.Name/reels/')).toBe(
      'creator.name',
    );
  });

  it('extracts the linked creator Instagram username from profile data', () => {
    expect(
      profileInstagramUsername({
        instagramIdentity: {
          username: '@Creator_Name',
        },
      }),
    ).toBe('creator_name');
  });
});
