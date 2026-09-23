import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 1, handle, custom_fields: {} };
}

function supabaseWithExisting(existing: string[]) {
  const filters: Array<[string, string]> = [];
  return {
    filters,
    from(table: string) {
      expect(table).toBe('brand_creator_roster');
      return {
        select() {
          return {
            eq(column: string, value: string) {
              filters.push([column, value]);
              return {
                async in(columnName: string, handles: string[]) {
                  expect(columnName).toBe('ig_username');
                  return {
                    data: existing
                      .filter((handle) => handles.includes(handle))
                      .map((ig_username) => ({ ig_username })),
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  };
}

describe('splitRowsByBrandRoster', () => {
  it('only treats handles as duplicates within the authenticated brand roster', async () => {
    const sb = supabaseWithExisting(['already']);

    const result = await splitRowsByBrandRoster(sb as never, 'brand-1', [
      row('already'),
      row('newcreator'),
    ]);

    expect(sb.filters).toEqual([['brand_id', 'brand-1']]);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['newcreator']);
  });
});
