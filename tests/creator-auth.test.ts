import { describe, expect, it } from 'vitest';
import {
  instagramUsernameForProfile,
  profileOwnsInstagramHandle,
} from '../src/lib/server/creatorProfileOwnership';
import type { UserProfileRow } from '../src/lib/server/supabase';

function profileWithInstagram(username: string | null): UserProfileRow {
  return {
    google_sub: 'creator-sub',
    email: null,
    name: null,
    profile_data: {
      instagramIdentity: username ? { username } : {},
    },
    platform_tokens: {},
    identity_graph: {},
    identity_summary: '',
    updated_at: '2026-07-03T00:00:00.000Z',
    wagwan_user_id: 'wagwan-user',
  };
}

describe('instagramUsernameForProfile', () => {
  it('normalizes the linked creator Instagram username', () => {
    expect(instagramUsernameForProfile(profileWithInstagram(' Creator.Name '))).toBe(
      'creator.name',
    );
  });

  it('returns null when no creator Instagram username is linked', () => {
    expect(instagramUsernameForProfile(profileWithInstagram(null))).toBeNull();
  });
});

describe('profileOwnsInstagramHandle', () => {
  it('matches roster handles case-insensitively and ignores @ prefixes', () => {
    expect(profileOwnsInstagramHandle(profileWithInstagram('Creator.Name'), '@creator.name')).toBe(
      true,
    );
  });

  it('rejects roster handles owned by a different Instagram account', () => {
    expect(profileOwnsInstagramHandle(profileWithInstagram('creator.name'), 'other.creator')).toBe(
      false,
    );
  });
});
