import { describe, expect, it } from 'vitest';
import { getCreatorInstagramUsername } from '../src/lib/server/creatorAuth';
import type { UserProfileRow } from '../src/lib/server/supabase';

function profileWithInstagram(username: unknown): UserProfileRow {
  return {
    google_sub: 'google-sub-1',
    email: null,
    name: null,
    profile_data: {
      instagramIdentity: { username },
    },
    platform_tokens: {},
    identity_graph: {},
    identity_summary: '',
    updated_at: '',
    wagwan_user_id: 'wagwan-user-1',
  };
}

describe('getCreatorInstagramUsername', () => {
  it('normalizes the linked creator Instagram username', () => {
    expect(getCreatorInstagramUsername(profileWithInstagram(' @Creator.One '))).toBe(
      'creator.one',
    );
  });

  it('returns null when the profile has no Instagram username', () => {
    expect(getCreatorInstagramUsername(profileWithInstagram(''))).toBeNull();
  });
});
