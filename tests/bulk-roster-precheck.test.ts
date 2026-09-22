import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

describe('splitRowsByBrandRoster', () => {
  it('checks existing handles only within the authenticated brand', async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const sb = {
      from(table: string) {
        calls.push({ method: 'from', args: [table] });
        return {
          select(columns: string) {
            calls.push({ method: 'select', args: [columns] });
            return this;
          },
          eq(column: string, value: string) {
            calls.push({ method: 'eq', args: [column, value] });
            return this;
          },
          in(column: string, values: string[]) {
            calls.push({ method: 'in', args: [column, values] });
            return Promise.resolve({
              data: [{ ig_username: 'creator_one' }],
              error: null,
            });
          },
        };
      },
    } as unknown as SupabaseClient;

    const rows: ParsedCreatorRow[] = [
      { row: 2, handle: 'creator_one', custom_fields: {} },
      { row: 3, handle: 'creator_two', custom_fields: {} },
    ];

    const result = await splitRowsByBrandRoster(sb, 'brand-a', rows);

    expect(calls).toContainEqual({ method: 'eq', args: ['brand_id', 'brand-a'] });
    expect(calls).toContainEqual({
      method: 'in',
      args: ['ig_username', ['creator_one', 'creator_two']],
    });
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((row) => row.handle)).toEqual(['creator_two']);
  });
});
