import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { filterRowsAlreadyInBrandRoster } from '../src/lib/server/marketplace/bulkRosterUpload';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function makeRow(handle: string): ParsedCreatorRow {
  return { row: 1, handle, custom_fields: {} };
}

function mockSupabase(existingByBrand: Record<string, string[]>): SupabaseClient {
  return {
    from(table: string) {
      expect(table).toBe('brand_creator_roster');

      let scopedBrandId = '';

      return {
        select(columns: string) {
          expect(columns).toBe('ig_username');
          return this;
        },
        eq(column: string, value: string) {
          expect(column).toBe('brand_id');
          scopedBrandId = value;
          return this;
        },
        async in(column: string, handles: string[]) {
          expect(column).toBe('ig_username');
          const existing = new Set(existingByBrand[scopedBrandId] ?? []);
          return {
            data: handles
              .filter((handle) => existing.has(handle))
              .map((ig_username) => ({ ig_username })),
          };
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe('filterRowsAlreadyInBrandRoster', () => {
  it('only skips handles already present for the current brand', async () => {
    const sb = mockSupabase({
      brand_a: ['sharedcreator'],
      brand_b: ['owncreator'],
    });

    const result = await filterRowsAlreadyInBrandRoster(sb, 'brand_b', [
      makeRow('sharedcreator'),
      makeRow('owncreator'),
      makeRow('newcreator'),
    ]);

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((row) => row.handle)).toEqual(['sharedcreator', 'newcreator']);
  });
});
