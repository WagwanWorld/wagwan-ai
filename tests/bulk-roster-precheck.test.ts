import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 2, handle, custom_fields: {} };
}

describe('splitRowsByBrandRoster', () => {
  it('only treats handles as duplicates within the authenticated brand', async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const sb = {
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
                      data: [{ ig_username: 'owned_creator' }],
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

    const split = await splitRowsByBrandRoster(sb, 'brand-a', [
      row('owned_creator'),
      row('cross_brand_creator'),
    ]);

    expect(calls).toContainEqual({ method: 'eq', args: ['brand_id', 'brand-a'] });
    expect(split.alreadyInRoster).toBe(1);
    expect(split.toProcess.map((r) => r.handle)).toEqual(['cross_brand_creator']);
  });

  it('fails closed when the roster duplicate precheck cannot be loaded', async () => {
    const sb = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  in() {
                    return Promise.resolve({
                      data: null,
                      error: new Error('database unavailable'),
                    });
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    await expect(splitRowsByBrandRoster(sb, 'brand-a', [row('creator')])).rejects.toThrow(
      'roster_precheck_failed',
    );
  });
});
