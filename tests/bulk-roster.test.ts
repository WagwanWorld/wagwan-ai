import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { partitionRowsByRosterMembership } from '../src/lib/server/marketplace/bulkRoster';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 2, handle, custom_fields: {} };
}

describe('partitionRowsByRosterMembership', () => {
  it('checks existing handles within the current brand only', async () => {
    const calls: Array<[string, string]> = [];
    const sb = {
      from(table: string) {
        calls.push(['from', table]);
        const query = {
          select(columns: string) {
            calls.push(['select', columns]);
            return query;
          },
          eq(column: string, value: string) {
            calls.push([column, value]);
            return query;
          },
          in(column: string, values: string[]) {
            calls.push([column, values.join(',')]);
            return Promise.resolve({
              data: [{ ig_username: 'samebrand' }],
              error: null,
            });
          },
        };
        return query;
      },
    } as unknown as SupabaseClient;

    const result = await partitionRowsByRosterMembership(sb, 'brand-1', [
      row('samebrand'),
      row('otherbrand'),
    ]);

    expect(calls).toContainEqual(['brand_id', 'brand-1']);
    expect(calls).toContainEqual(['ig_username', 'samebrand,otherbrand']);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['otherbrand']);
  });
});
