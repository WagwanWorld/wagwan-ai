import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 2, handle, custom_fields: {} };
}

describe('splitRowsByBrandRoster', () => {
  it('checks existing handles within the authenticated brand only', async () => {
    const filters: Array<{ column: string; value: unknown }> = [];
    const sb = {
      from(table: string) {
        expect(table).toBe('brand_creator_roster');
        return {
          select(columns: string) {
            expect(columns).toBe('ig_username');
            return {
              eq(column: string, value: unknown) {
                filters.push({ column, value });
                return {
                  in(column: string, value: unknown) {
                    filters.push({ column, value });
                    return Promise.resolve({
                      data: [{ ig_username: 'samebrand' }],
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

    const result = await splitRowsByBrandRoster(sb, 'brand-1', [
      row('samebrand'),
      row('otherbrand'),
    ]);

    expect(filters).toEqual([
      { column: 'brand_id', value: 'brand-1' },
      { column: 'ig_username', value: ['samebrand', 'otherbrand'] },
    ]);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['otherbrand']);
  });

  it('fails closed when the precheck query fails', async () => {
    const sb = {
      from() {
        return {
          select() {
            return {
              eq() {
                return {
                  in() {
                    return Promise.resolve({ data: null, error: { message: 'db unavailable' } });
                  },
                };
              },
            };
          },
        };
      },
    } as unknown as SupabaseClient;

    await expect(splitRowsByBrandRoster(sb, 'brand-1', [row('creator')])).rejects.toThrow(
      'roster_precheck_failed',
    );
  });
});
