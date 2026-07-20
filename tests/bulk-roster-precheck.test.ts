import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 1, handle, custom_fields: {} };
}

function mockSupabase(existingByBrand: Record<string, string[]>) {
  const calls: Array<{ table: string; column: string; value: string }> = [];
  return {
    calls,
    from(table: string) {
      return {
        select() {
          return this;
        },
        eq(column: string, value: string) {
          calls.push({ table, column, value });
          return {
            in: async (_column: string, handles: string[]) => ({
              data: (existingByBrand[value] ?? [])
                .filter((handle) => handles.includes(handle))
                .map((ig_username) => ({ ig_username })),
              error: null,
            }),
          };
        },
      };
    },
  };
}

describe('splitRowsByBrandRoster', () => {
  it('only skips handles already present for the authenticated brand', async () => {
    const sb = mockSupabase({
      brand_a: ['sharedcreator'],
      brand_b: ['existingforb'],
    });

    const result = await splitRowsByBrandRoster(sb as never, 'brand_b', [
      row('sharedcreator'),
      row('existingforb'),
      row('newcreator'),
    ]);

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['sharedcreator', 'newcreator']);
    expect(sb.calls).toEqual([
      { table: 'brand_creator_roster', column: 'brand_id', value: 'brand_b' },
    ]);
  });
});
