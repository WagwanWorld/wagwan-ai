import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  splitRowsByBrandRoster,
  type RosterPrecheckResult,
} from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 2, handle, custom_fields: {} };
}

function createFakeSupabase(existingRows: Array<{ ig_username: string }>) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const query = {
    select(...args: unknown[]) {
      calls.push({ method: 'select', args });
      return query;
    },
    eq(...args: unknown[]) {
      calls.push({ method: 'eq', args });
      return query;
    },
    in(...args: unknown[]) {
      calls.push({ method: 'in', args });
      return Promise.resolve({ data: existingRows, error: null });
    },
  };
  const sb = {
    from(...args: unknown[]) {
      calls.push({ method: 'from', args });
      return query;
    },
  };

  return { sb: sb as unknown as SupabaseClient, calls };
}

describe('splitRowsByBrandRoster', () => {
  it('only treats handles as existing when they are in the current brand roster', async () => {
    const { sb, calls } = createFakeSupabase([{ ig_username: 'alice' }]);

    const result: RosterPrecheckResult = await splitRowsByBrandRoster(sb, 'brand-b', [
      row('alice'),
      row('bob'),
    ]);

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['bob']);
    expect(calls).toContainEqual({ method: 'from', args: ['brand_creator_roster'] });
    expect(calls).toContainEqual({ method: 'eq', args: ['brand_id', 'brand-b'] });
    expect(calls).toContainEqual({ method: 'in', args: ['ig_username', ['alice', 'bob']] });
  });

  it('does not query when there are no valid rows', async () => {
    const { sb, calls } = createFakeSupabase([]);

    await expect(splitRowsByBrandRoster(sb, 'brand-b', [])).resolves.toEqual({
      alreadyInRoster: 0,
      toProcess: [],
    });
    expect(calls).toEqual([]);
  });
});
