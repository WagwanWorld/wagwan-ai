import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 1, handle, custom_fields: {} };
}

describe('splitRowsByBrandRoster', () => {
  it('checks existing handles within the authenticated brand only', async () => {
    const calls: Array<[string, unknown]> = [];
    const query = {
      select(value: string) {
        calls.push(['select', value]);
        return this;
      },
      eq(column: string, value: string) {
        calls.push(['eq', [column, value]]);
        return this;
      },
      in(column: string, value: string[]) {
        calls.push(['in', [column, value]]);
        return Promise.resolve({ data: [{ ig_username: 'alice' }], error: null });
      },
    };
    const sb = {
      from(table: string) {
        calls.push(['from', table]);
        return query;
      },
    };

    const result = await splitRowsByBrandRoster(sb as never, 'brand-a', [row('alice'), row('bob')]);

    expect(calls).toContainEqual(['from', 'brand_creator_roster']);
    expect(calls).toContainEqual(['eq', ['brand_id', 'brand-a']]);
    expect(calls).toContainEqual(['in', ['ig_username', ['alice', 'bob']]]);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['bob']);
  });
});
