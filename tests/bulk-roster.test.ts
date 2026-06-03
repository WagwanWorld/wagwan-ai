import { describe, expect, it } from 'vitest';
import { splitRowsByExistingRoster } from '../src/lib/server/marketplace/bulkRoster';

describe('splitRowsByExistingRoster', () => {
  it('checks existing handles within the current brand only', async () => {
    const calls: Array<[string, string]> = [];
    const sb = {
      from(table: 'brand_creator_roster') {
        calls.push(['from', table]);
        return {
          select(columns: 'ig_username') {
            calls.push(['select', columns]);
            return {
              eq(column: 'brand_id', value: string) {
                calls.push(['eq', `${column}:${value}`]);
                return {
                  async in(column: 'ig_username', values: string[]) {
                    calls.push(['in', `${column}:${values.join(',')}`]);
                    return { data: [{ ig_username: 'shared_creator' }] };
                  },
                };
              },
            };
          },
        };
      },
    };

    const result = await splitRowsByExistingRoster(sb, 'brand-b', [
      { row: 2, handle: 'shared_creator', custom_fields: {} },
      { row: 3, handle: 'new_creator', custom_fields: {} },
    ]);

    expect(calls).toEqual([
      ['from', 'brand_creator_roster'],
      ['select', 'ig_username'],
      ['eq', 'brand_id:brand-b'],
      ['in', 'ig_username:shared_creator,new_creator'],
    ]);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((row) => row.handle)).toEqual(['new_creator']);
  });
});
