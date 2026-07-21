import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 2, handle, custom_fields: {} };
}

function mockSupabase(existingHandles: string[]) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const client = {
    from(table: string) {
      calls.push({ method: 'from', args: [table] });
      return {
        select(columns: string) {
          calls.push({ method: 'select', args: [columns] });
          return {
            eq(column: string, value: string) {
              calls.push({ method: 'eq', args: [column, value] });
              return {
                in(column: string, values: string[]) {
                  calls.push({ method: 'in', args: [column, values] });
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
  } as unknown as SupabaseClient;

  return { client, calls };
}

describe('splitRowsByBrandRoster', () => {
  it('filters existing handles using the resolved brand id', async () => {
    const { client, calls } = mockSupabase(['already_here']);

    const result = await splitRowsByBrandRoster(client, 'brand-1', [
      row('already_here'),
      row('new_creator'),
    ]);

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['new_creator']);
    expect(calls).toContainEqual({ method: 'eq', args: ['brand_id', 'brand-1'] });
    expect(calls).toContainEqual({
      method: 'in',
      args: ['ig_username', ['already_here', 'new_creator']],
    });
  });
});
