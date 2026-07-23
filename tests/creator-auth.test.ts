import { describe, expect, it, vi } from 'vitest';

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import {
  instagramUsernameFromProfileData,
  normalizeInstagramUsername,
} from '../src/lib/server/creatorAuth';

describe('creator auth helpers', () => {
  it('normalizes Instagram handles for invite ownership checks', () => {
    expect(normalizeInstagramUsername('@Creator.Name ')).toBe('creator.name');
    expect(normalizeInstagramUsername('')).toBeNull();
    expect(normalizeInstagramUsername(null)).toBeNull();
  });

  it('extracts the linked creator Instagram username from profile data', () => {
    expect(
      instagramUsernameFromProfileData({
        instagramIdentity: {
          username: '@Creator_One',
        },
      }),
    ).toBe('creator_one');

    expect(instagramUsernameFromProfileData({ instagramIdentity: {} })).toBeNull();
  });
});
