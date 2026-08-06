import { describe, expect, it, vi } from 'vitest';
import { normalizeInstagramUsername, instagramUsernameFromProfileData } from '../src/lib/server/creatorIdentity';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import { coerceRosterProfileSnapshot } from '../src/lib/types/creator-invite';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

vi.mock('xlsx', () => ({}));

describe('creator identity guards', () => {
  it('normalizes Instagram usernames from profile data', () => {
    expect(normalizeInstagramUsername('@Creator.Name')).toBe('creator.name');
    expect(normalizeInstagramUsername('https://www.instagram.com/Creator_Name/reels')).toBe(
      'creator_name',
    );
    expect(
      instagramUsernameFromProfileData({
        instagramIdentity: { username: 'Invited.Creator' },
      }),
    ).toBe('invited.creator');
  });
});

describe('splitRowsByBrandRoster', () => {
  const row = (handle: string): ParsedCreatorRow => ({ row: 2, handle, custom_fields: {} });

  it('only treats handles as duplicates for the resolved brand', () => {
    const result = splitRowsByBrandRoster(
      [row('samecreator'), row('newcreator')],
      [
        { brand_id: 'brand-a', ig_username: 'samecreator' },
        { brand_id: 'brand-b', ig_username: 'newcreator' },
      ],
      'brand-a',
    );

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['newcreator']);
  });
});

describe('coerceRosterProfileSnapshot', () => {
  it('preserves bulk-upload sheet fields on roster readback', () => {
    const snapshot = coerceRosterProfileSnapshot(
      {
        handle: 'creator',
        displayName: 'Creator',
        email: 'creator@example.com',
        phone: '+911234567890',
        rates: 'INR 25k',
        notes: 'Prefers WhatsApp',
        tags: 'fashion,lifestyle',
        custom_fields: { manager: 'Asha', priority: 1 },
        scrapedAt: '2026-01-01T00:00:00.000Z',
      },
      'fallback',
    );

    expect(snapshot.email).toBe('creator@example.com');
    expect(snapshot.phone).toBe('+911234567890');
    expect(snapshot.rates).toBe('INR 25k');
    expect(snapshot.notes).toBe('Prefers WhatsApp');
    expect(snapshot.tags).toBe('fashion,lifestyle');
    expect(snapshot.custom_fields).toEqual({ manager: 'Asha', priority: '1' });
  });
});
