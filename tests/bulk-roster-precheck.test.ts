import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

describe('splitRowsByBrandRoster', () => {
  it('checks duplicate handles within the authenticated brand only', async () => {
    const calls: Array<{ op: string; args: unknown[] }> = [];
    const sb = {
      from(table: string) {
        calls.push({ op: 'from', args: [table] });
        return {
          select(columns: string) {
            calls.push({ op: 'select', args: [columns] });
            return {
              eq(column: string, value: string) {
                calls.push({ op: 'eq', args: [column, value] });
                return {
                  in(column: string, values: string[]) {
                    calls.push({ op: 'in', args: [column, values] });
                    return Promise.resolve({
                      data: [{ ig_username: 'creator_a' }],
                      error: null,
                    });
                  },
                };
              },
            };
          },
        };
      },
    };
    const rows: ParsedCreatorRow[] = [
      { row: 2, handle: 'creator_a', custom_fields: {} },
      { row: 3, handle: 'creator_b', custom_fields: {} },
    ];

    const result = await splitRowsByBrandRoster(sb as never, 'brand-1', rows);

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((row) => row.handle)).toEqual(['creator_b']);
    expect(calls).toContainEqual({ op: 'eq', args: ['brand_id', 'brand-1'] });
    expect(calls).toContainEqual({
      op: 'in',
      args: ['ig_username', ['creator_a', 'creator_b']],
    });
  });
});
