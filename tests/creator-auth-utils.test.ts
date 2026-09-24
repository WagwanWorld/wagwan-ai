import { describe, expect, it } from 'vitest';
import {
  instagramUsernameFromProfileData,
  normalizeCreatorInstagramUsername,
} from '../src/lib/server/creatorIdentity';

describe('creator identity helpers', () => {
  it('normalizes Instagram usernames for invite ownership checks', () => {
    expect(normalizeCreatorInstagramUsername('@Creator.Name ')).toBe('creator.name');
    expect(normalizeCreatorInstagramUsername('')).toBeNull();
  });

  it('extracts the linked Instagram username from profile data', () => {
    expect(
      instagramUsernameFromProfileData({
        instagramIdentity: { username: 'MatchedCreator' },
      }),
    ).toBe('matchedcreator');
  });
});
