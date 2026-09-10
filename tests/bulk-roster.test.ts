import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  findExistingRosterHandles,
  mergeSheetMetadataIntoSnapshot,
} from '../src/lib/server/marketplace/bulkRoster';

describe('bulk roster helpers', () => {
  it('scopes existing-handle checks to the authenticated brand', async () => {
    const calls: Array<[string, unknown]> = [];
    const sb = {
      from(table: string) {
        calls.push(['from', table]);
        return {
          select(columns: string) {
            calls.push(['select', columns]);
            return this;
          },
          eq(column: string, value: unknown) {
            calls.push([`eq:${column}`, value]);
            return this;
          },
          in(column: string, values: unknown[]) {
            calls.push([`in:${column}`, values]);
            return Promise.resolve({ data: [{ ig_username: 'creator_a' }], error: null });
          },
        };
      },
    } as unknown as SupabaseClient;

    const existing = await findExistingRosterHandles(sb, 'brand-1', ['creator_a', 'creator_b']);

    expect(existing).toEqual(new Set(['creator_a']));
    expect(calls).toContainEqual(['from', 'brand_creator_roster']);
    expect(calls).toContainEqual(['eq:brand_id', 'brand-1']);
    expect(calls).toContainEqual(['in:ig_username', ['creator_a', 'creator_b']]);
  });

  it('merges uploaded sheet metadata without mutating the original snapshot', () => {
    const original = { handle: 'creator_a', followers: '12K' };
    const merged = mergeSheetMetadataIntoSnapshot(original, {
      row: 2,
      handle: 'creator_a',
      email: 'creator@example.com',
      phone: '+919999999999',
      rates: 'INR 5000',
      notes: 'Prefers reels',
      tags: 'fashion, travel',
      location: 'Mumbai',
      custom_fields: { manager: 'Asha' },
    });

    expect(merged).toMatchObject({
      handle: 'creator_a',
      followers: '12K',
      email: 'creator@example.com',
      phone: '+919999999999',
      rates: 'INR 5000',
      notes: 'Prefers reels',
      tags: 'fashion, travel',
      location: 'Mumbai',
      custom_fields: { manager: 'Asha' },
    });
    expect(original).toEqual({ handle: 'creator_a', followers: '12K' });
  });
});
