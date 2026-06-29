import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getExistingRosterHandlesForBrand } from '../src/lib/server/marketplace/bulkRoster';

describe('getExistingRosterHandlesForBrand', () => {
  it('scopes existing roster lookup to the active brand', async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const query = {
      select(...args: unknown[]) {
        calls.push({ method: 'select', args });
        return this;
      },
      eq(...args: unknown[]) {
        calls.push({ method: 'eq', args });
        return this;
      },
      in(...args: unknown[]) {
        calls.push({ method: 'in', args });
        return Promise.resolve({
          data: [{ ig_username: 'sharedcreator' }],
          error: null,
        });
      },
    };
    const sb = {
      from(...args: unknown[]) {
        calls.push({ method: 'from', args });
        return query;
      },
    } as unknown as SupabaseClient;

    const handles = await getExistingRosterHandlesForBrand(sb, 'brand-b', [
      'sharedcreator',
      'newcreator',
    ]);

    expect(handles).toEqual(new Set(['sharedcreator']));
    expect(calls).toContainEqual({ method: 'from', args: ['brand_creator_roster'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['brand_id', 'brand-b'] });
    expect(calls).toContainEqual({
      method: 'in',
      args: ['ig_username', ['sharedcreator', 'newcreator']],
    });
  });

  it('does not query when there are no handles', async () => {
    const sb = {
      from() {
        throw new Error('should_not_query');
      },
    } as unknown as SupabaseClient;

    await expect(getExistingRosterHandlesForBrand(sb, 'brand-b', [])).resolves.toEqual(new Set());
  });
});
