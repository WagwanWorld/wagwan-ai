import { describe, expect, it } from 'vitest';
import {
  extractProfileInstagramUsername,
  normalizeInstagramUsername,
} from '../src/lib/server/creatorIdentity';

describe('creator identity helpers', () => {
  it('normalizes Instagram usernames for invite ownership checks', () => {
    expect(normalizeInstagramUsername('@Creator.Name ')).toBe('creator.name');
  });

  it('extracts the linked profile Instagram username', () => {
    expect(
      extractProfileInstagramUsername({
        instagramIdentity: {
          username: '@Claimed_Creator',
        },
      }),
    ).toBe('claimed_creator');
  });

  it('returns an empty username when no Instagram identity is present', () => {
    expect(extractProfileInstagramUsername({})).toBe('');
  });
});
