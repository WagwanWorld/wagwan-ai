import { describe, expect, it } from 'vitest';
import { listExistingRosterHandlesForBrand } from '../src/lib/server/marketplace/bulkRoster';

describe('listExistingRosterHandlesForBrand', () => {
  it('scopes duplicate detection to the uploading brand', async () => {
    const calls: Array<[string, string, unknown]> = [];
    const query = {
      select(column: string) {
        calls.push(['select', column, undefined]);
        return this;
      },
      eq(column: string, value: unknown) {
        calls.push(['eq', column, value]);
        return this;
      },
      in(column: string, value: unknown) {
        calls.push(['in', column, value]);
        return Promise.resolve({ data: [{ ig_username: 'creator_a' }] });
      },
    };
    const sb = {
      from(table: string) {
        calls.push(['from', table, undefined]);
        return query;
      },
    };

    const existing = await listExistingRosterHandlesForBrand(
      sb as never,
      'brand-a',
      ['creator_a', 'creator_b'],
    );

    expect(existing).toEqual(new Set(['creator_a']));
    expect(calls).toContainEqual(['from', 'brand_creator_roster', undefined]);
    expect(calls).toContainEqual(['eq', 'brand_id', 'brand-a']);
    expect(calls).toContainEqual(['in', 'ig_username', ['creator_a', 'creator_b']]);
  });
});
