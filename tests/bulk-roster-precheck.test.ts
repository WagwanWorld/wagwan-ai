import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 2, handle, custom_fields: {} };
}

describe('splitRowsByBrandRoster', () => {
  it('scopes existing-roster prechecks to the authenticated brand', async () => {
    const filters: Array<[string, unknown]> = [];
    const fakeSb = {
      from(table: string) {
        expect(table).toBe('brand_creator_roster');
        return {
          select(columns: string) {
            expect(columns).toBe('ig_username');
            return {
              eq(column: string, value: unknown) {
                filters.push([column, value]);
                return {
                  async in(column: string, handles: string[]) {
                    filters.push([column, handles]);
                    return { data: [{ ig_username: 'samecreator' }], error: null };
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    const result = await splitRowsByBrandRoster(fakeSb, 'brand-b', [
      row('samecreator'),
      row('newcreator'),
    ]);

    expect(filters).toEqual([
      ['brand_id', 'brand-b'],
      ['ig_username', ['samecreator', 'newcreator']],
    ]);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['newcreator']);
  });
});
