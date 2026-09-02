import { describe, expect, it } from 'vitest';
import {
  getProfileInstagramUsername,
  normalizeInstagramUsername,
} from '../src/lib/server/creatorIdentity';

describe('creator auth identity helpers', () => {
  it('normalizes Instagram usernames for roster ownership checks', () => {
    expect(normalizeInstagramUsername('@Creator.Name')).toBe('creator.name');
    expect(normalizeInstagramUsername('  MIXED_Case  ')).toBe('mixed_case');
    expect(normalizeInstagramUsername('')).toBeNull();
  });

  it('extracts the linked profile Instagram username', () => {
    expect(
      getProfileInstagramUsername({
        instagramIdentity: { username: '@OwnerHandle' },
      }),
    ).toBe('ownerhandle');
    expect(getProfileInstagramUsername({ instagramIdentity: {} })).toBeNull();
  });
});
