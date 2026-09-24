import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return {
    row: 1,
    handle,
    custom_fields: {},
  };
}

describe('splitRowsByBrandRoster', () => {
  it('checks existing handles only within the authenticated brand roster', async () => {
    const eqCalls: Array<[string, string]> = [];
    const inCalls: Array<[string, string[]]> = [];
    const query = {
      select() {
        return this;
      },
      eq(column: string, value: string) {
        eqCalls.push([column, value]);
        return this;
      },
      async in(column: string, values: string[]) {
        inCalls.push([column, values]);
        return { data: [{ ig_username: 'already_here' }], error: null };
      },
    };
    const sb = {
      from(table: string) {
        expect(table).toBe('brand_creator_roster');
        return query;
      },
    };

    const result = await splitRowsByBrandRoster(sb as never, 'brand-a', [
      row('already_here'),
      row('new_creator'),
    ]);

    expect(eqCalls).toEqual([['brand_id', 'brand-a']]);
    expect(inCalls).toEqual([['ig_username', ['already_here', 'new_creator']]]);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['new_creator']);
  });
});
