import { describe, expect, it } from 'vitest';
import {
  normalizeInstagramUsername,
  profileInstagramUsername,
} from '../src/lib/server/creatorIdentity';

describe('creator identity helpers', () => {
  it('normalizes Instagram usernames for invite ownership checks', () => {
    expect(normalizeInstagramUsername(' @Creator.Name ')).toBe('creator.name');
    expect(normalizeInstagramUsername('')).toBeNull();
    expect(normalizeInstagramUsername(null)).toBeNull();
  });

  it('extracts the linked profile Instagram username', () => {
    expect(
      profileInstagramUsername({
        instagramIdentity: { username: '@RealCreator' },
      }),
    ).toBe('realcreator');
    expect(profileInstagramUsername({ instagramIdentity: {} })).toBeNull();
  });
});
