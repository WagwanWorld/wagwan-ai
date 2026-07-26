import { describe, expect, it } from 'vitest';
import {
  getProfileInstagramUsername,
  normalizeInstagramUsername,
} from '../src/lib/server/creatorAuth';
import { coerceRosterProfileSnapshot } from '../src/lib/types/creator-invite';

describe('creator invite identity helpers', () => {
  it('normalizes Instagram usernames for invite ownership checks', () => {
    expect(normalizeInstagramUsername('@Alice.Creator ')).toBe('alice.creator');
    expect(normalizeInstagramUsername('BOB_CREATOR')).toBe('bob_creator');
    expect(normalizeInstagramUsername(null)).toBe('');
  });

  it('extracts the Instagram username from creator profile data', () => {
    expect(
      getProfileInstagramUsername({
        instagramIdentity: { username: '@Invite.Owner' },
      }),
    ).toBe('invite.owner');
  });
});

describe('coerceRosterProfileSnapshot', () => {
  it('preserves bulk-upload contact and custom fields on roster reads', () => {
    const snapshot = coerceRosterProfileSnapshot(
      {
        handle: 'creator_one',
        displayName: 'Creator One',
        bio: 'Creator bio',
        followers: '12K',
        followersCount: 12000,
        following: '400',
        posts: '80',
        isVerified: false,
        onPlatform: false,
        scrapedAt: '2026-07-26T00:00:00.000Z',
        email: 'creator@example.com',
        phone: '+919999999999',
        rates: 'INR 20,000',
        notes: 'Prefers email',
        tags: 'fashion, nightlife',
        custom_fields: {
          Manager: 'Asha',
          Empty: '',
          Nullish: null,
        },
      },
      'fallback',
    );

    expect(snapshot.email).toBe('creator@example.com');
    expect(snapshot.phone).toBe('+919999999999');
    expect(snapshot.rates).toBe('INR 20,000');
    expect(snapshot.notes).toBe('Prefers email');
    expect(snapshot.tags).toBe('fashion, nightlife');
    expect(snapshot.custom_fields).toEqual({ Manager: 'Asha' });
  });
});
