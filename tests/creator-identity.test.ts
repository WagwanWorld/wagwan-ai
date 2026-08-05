import { describe, expect, it } from 'vitest';
import {
  creatorInstagramMatchesRoster,
  instagramUsernameFromProfile,
  normalizeInstagramUsername,
} from '../src/lib/server/creatorIdentity';

describe('creator identity helpers', () => {
  it('normalizes Instagram usernames from handles and URLs', () => {
    expect(normalizeInstagramUsername('@Creator.Name')).toBe('creator.name');
    expect(normalizeInstagramUsername('https://www.instagram.com/Creator_Name/')).toBe(
      'creator_name',
    );
  });

  it('extracts the linked creator Instagram username from profile data', () => {
    expect(
      instagramUsernameFromProfile({
        instagramIdentity: { username: 'Invited.Creator' },
      }),
    ).toBe('invited.creator');
  });

  it('requires the authenticated creator handle to match the roster invite handle', () => {
    const profile = { instagramIdentity: { username: 'right_creator' } };

    expect(creatorInstagramMatchesRoster(profile, '@right_creator')).toBe(true);
    expect(creatorInstagramMatchesRoster(profile, '@other_creator')).toBe(false);
    expect(creatorInstagramMatchesRoster({}, '@right_creator')).toBe(false);
  });
});
