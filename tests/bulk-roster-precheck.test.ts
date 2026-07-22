import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 1, handle, custom_fields: {} };
}

describe('splitRowsByBrandRoster', () => {
  it('checks existing handles within the current brand only', async () => {
    const calls: Array<[string, unknown]> = [];
    const sb = {
      from(table: string) {
        calls.push(['from', table]);
        return {
          select(columns: string) {
            calls.push(['select', columns]);
            return {
              eq(column: string, value: string) {
                calls.push(['eq', [column, value]]);
                return {
                  in(column: string, values: string[]) {
                    calls.push(['in', [column, values]]);
                    return Promise.resolve({
                      data: [{ ig_username: 'already_here' }],
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

    const result = await splitRowsByBrandRoster(sb, 'brand-b', [
      row('already_here'),
      row('cross_brand_only'),
    ]);

    expect(calls).toContainEqual(['eq', ['brand_id', 'brand-b']]);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['cross_brand_only']);
  });

  it('fails closed when the roster precheck query fails', async () => {
    const sb = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  in() {
                    return Promise.resolve({ data: null, error: new Error('db unavailable') });
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    await expect(splitRowsByBrandRoster(sb, 'brand-b', [row('creator')])).rejects.toThrow(
      'roster_precheck_failed',
    );
  });
});
