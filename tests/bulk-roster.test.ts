import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getExistingRosterHandlesForBrand } from '../src/lib/server/marketplace/bulkRoster';

describe('getExistingRosterHandlesForBrand', () => {
  it('scopes existing creator checks to the current brand', async () => {
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
        return Promise.resolve({ data: [{ ig_username: 'sharedcreator' }] });
      },
    };
    const sb = {
      from(...args: unknown[]) {
        calls.push({ method: 'from', args });
        return query;
      },
    } as unknown as SupabaseClient;

    const existing = await getExistingRosterHandlesForBrand(sb, 'brand-b', [
      'sharedcreator',
      'newcreator',
    ]);

    expect(existing).toEqual(new Set(['sharedcreator']));
    expect(calls).toContainEqual({ method: 'from', args: ['brand_creator_roster'] });
    expect(calls).toContainEqual({ method: 'select', args: ['ig_username'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['brand_id', 'brand-b'] });
    expect(calls).toContainEqual({
      method: 'in',
      args: ['ig_username', ['sharedcreator', 'newcreator']],
    });
  });
});
