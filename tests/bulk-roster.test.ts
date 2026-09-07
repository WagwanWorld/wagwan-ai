import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';
import type { SupabaseClient } from '@supabase/supabase-js';

describe('splitRowsByBrandRoster', () => {
  it('checks existing handles within the authenticated brand only', async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const sb = {
      from(table: string) {
        calls.push({ method: 'from', args: [table] });
        return {
          select(columns: string) {
            calls.push({ method: 'select', args: [columns] });
            return this;
          },
          eq(column: string, value: unknown) {
            calls.push({ method: 'eq', args: [column, value] });
            return this;
          },
          in(column: string, values: unknown[]) {
            calls.push({ method: 'in', args: [column, values] });
            return { data: [{ ig_username: 'owned' }], error: null };
          },
        };
      },
    } as unknown as SupabaseClient;

    const rows = [
      { row: 2, handle: 'owned', custom_fields: {} },
      { row: 3, handle: 'cross_brand_duplicate', custom_fields: {} },
    ] satisfies ParsedCreatorRow[];

    const result = await splitRowsByBrandRoster(sb, 'brand-123', rows);

    expect(calls).toContainEqual({ method: 'eq', args: ['brand_id', 'brand-123'] });
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((row) => row.handle)).toEqual(['cross_brand_duplicate']);
  });
});
