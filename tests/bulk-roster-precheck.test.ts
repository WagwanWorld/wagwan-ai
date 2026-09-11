import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 2, handle, custom_fields: {} };
}

function mockSupabase(existingRows: Array<{ brand_id: string; ig_username: string }>) {
  return {
    from(table: string) {
      expect(table).toBe('brand_creator_roster');

      const filters: Record<string, unknown> = {};
      let requestedHandles: string[] = [];

      const query = {
        select(columns: string) {
          expect(columns).toBe('ig_username');
          return query;
        },
        eq(column: string, value: unknown) {
          filters[column] = value;
          return query;
        },
        in(column: string, values: string[]) {
          expect(column).toBe('ig_username');
          requestedHandles = values;
          return query;
        },
        then(resolve: (result: { data: Array<{ ig_username: string }>; error: null }) => void) {
          resolve({
            data: existingRows
              .filter((existing) => existing.brand_id === filters.brand_id)
              .filter((existing) => requestedHandles.includes(existing.ig_username))
              .map(({ ig_username }) => ({ ig_username })),
            error: null,
          });
        },
      };

      return query;
    },
  };
}

describe('splitRowsByBrandRoster', () => {
  it('only treats handles as existing when they belong to the same brand', async () => {
    const sb = mockSupabase([
      { brand_id: 'brand-a', ig_username: 'sharedcreator' },
      { brand_id: 'brand-b', ig_username: 'brandbonly' },
    ]);

    const result = await splitRowsByBrandRoster(sb as never, 'brand-b', [
      row('sharedcreator'),
      row('brandbonly'),
      row('newcreator'),
    ]);

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['sharedcreator', 'newcreator']);
  });
});
