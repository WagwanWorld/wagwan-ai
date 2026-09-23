import { describe, expect, it } from 'vitest';
import {
  normalizeInstagramUsername,
  profileInstagramUsername,
} from '../src/lib/server/creatorIdentity';

describe('creator auth identity helpers', () => {
  it('normalizes Instagram usernames before comparing roster ownership', () => {
    expect(normalizeInstagramUsername('@Creator.Name')).toBe('creator.name');
    expect(normalizeInstagramUsername(' CREATOR_NAME ')).toBe('creator_name');
  });

  it('extracts the linked creator Instagram username from saved profile data', () => {
    expect(
      profileInstagramUsername({
        instagramIdentity: { username: '@RiyaHundi' },
      }),
    ).toBe('riyahundi');
  });
});
