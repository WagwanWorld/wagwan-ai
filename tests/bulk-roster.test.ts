import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getExistingRosterHandlesForBrand } from '../src/lib/server/marketplace/bulkRoster';

function makeRosterLookupClient(result: {
  data: Array<{ ig_username: string }> | null;
  error: { message: string } | null;
}) {
  const calls: Array<[string, ...unknown[]]> = [];
  const query = {
    select(columns: string) {
      calls.push(['select', columns]);
      return query;
    },
    eq(column: string, value: string) {
      calls.push(['eq', column, value]);
      return query;
    },
    in(column: string, values: string[]) {
      calls.push(['in', column, values]);
      return Promise.resolve(result);
    },
  };

  return {
    calls,
    client: {
      from(table: string) {
        calls.push(['from', table]);
        return query;
      },
    } as unknown as SupabaseClient,
  };
}

describe('getExistingRosterHandlesForBrand', () => {
  it('scopes duplicate lookups to the current brand roster', async () => {
    const { client, calls } = makeRosterLookupClient({
      data: [{ ig_username: 'creator_one' }],
      error: null,
    });

    const handles = await getExistingRosterHandlesForBrand(client, 'brand-b', [
      'creator_one',
      'creator_two',
    ]);

    expect([...handles]).toEqual(['creator_one']);
    expect(calls).toEqual([
      ['from', 'brand_creator_roster'],
      ['select', 'ig_username'],
      ['eq', 'brand_id', 'brand-b'],
      ['in', 'ig_username', ['creator_one', 'creator_two']],
    ]);
  });

  it('does not query when there are no handles', async () => {
    const from = vi.fn();
    const client = { from } as unknown as SupabaseClient;

    await expect(getExistingRosterHandlesForBrand(client, 'brand-b', [])).resolves.toEqual(
      new Set(),
    );
    expect(from).not.toHaveBeenCalled();
  });
});
