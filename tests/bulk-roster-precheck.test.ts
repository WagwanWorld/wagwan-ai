import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';

function makeSupabaseStub(existingHandles: string[]) {
  const calls: Array<[string, unknown]> = [];
  const sb = {
    from(table: string) {
      calls.push(['from', table]);
      return {
        select(columns: string) {
          calls.push(['select', columns]);
          return {
            eq(column: string, value: string) {
              calls.push(['eq', { column, value }]);
              return {
                in(column: string, values: string[]) {
                  calls.push(['in', { column, values }]);
                  return Promise.resolve({
                    data: existingHandles.map((ig_username) => ({ ig_username })),
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  return { sb: sb as unknown as SupabaseClient, calls };
}

describe('splitRowsByBrandRoster', () => {
  it('checks existing handles only within the resolved brand roster', async () => {
    const { sb, calls } = makeSupabaseStub(['alice']);

    const result = await splitRowsByBrandRoster(sb, 'brand-1', [
      { handle: 'alice', row: 2 },
      { handle: 'bob', row: 3 },
    ]);

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess).toEqual([{ handle: 'bob', row: 3 }]);
    expect(calls).toContainEqual(['eq', { column: 'brand_id', value: 'brand-1' }]);
    expect(calls).toContainEqual(['in', { column: 'ig_username', values: ['alice', 'bob'] }]);
  });
});
