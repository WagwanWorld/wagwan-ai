import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 2, handle, custom_fields: {} };
}

describe('splitRowsByBrandRoster', () => {
  it('only treats handles as existing when they belong to the authenticated brand', async () => {
    const calls: Array<[string, string]> = [];
    const sb = {
      from(table: string) {
        expect(table).toBe('brand_creator_roster');
        return {
          select(columns: string) {
            expect(columns).toBe('ig_username');
            return this;
          },
          eq(column: string, value: string) {
            calls.push([column, value]);
            return this;
          },
          in(column: string, values: string[]) {
            expect(column).toBe('ig_username');
            expect(values).toEqual(['sharedhandle', 'localhandle']);
            return { data: [{ ig_username: 'localhandle' }], error: null };
          },
        };
      },
    } as unknown as SupabaseClient;

    const result = await splitRowsByBrandRoster(sb, 'brand-1', [
      row('sharedhandle'),
      row('localhandle'),
    ]);

    expect(calls).toEqual([['brand_id', 'brand-1']]);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['sharedhandle']);
  });
});
