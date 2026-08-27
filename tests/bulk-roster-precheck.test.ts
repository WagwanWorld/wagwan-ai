import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 1, handle, custom_fields: {} };
}

describe('splitRowsByBrandRoster', () => {
  it('only skips handles already present for the authenticated brand', async () => {
    const table = [
      { brand_id: 'brand-a', ig_username: 'shared' },
      { brand_id: 'brand-b', ig_username: 'other-brand-only' },
    ];
    const eqCalls: Array<[string, string]> = [];

    const sb = {
      from(tableName: string) {
        expect(tableName).toBe('brand_creator_roster');
        const query = {
          brandId: '',
          select(columns: string) {
            expect(columns).toBe('ig_username');
            return this;
          },
          eq(column: string, value: string) {
            eqCalls.push([column, value]);
            if (column === 'brand_id') this.brandId = value;
            return this;
          },
          async in(column: string, handles: string[]) {
            expect(column).toBe('ig_username');
            return {
              data: table
                .filter((entry) => entry.brand_id === this.brandId)
                .filter((entry) => handles.includes(entry.ig_username))
                .map(({ ig_username }) => ({ ig_username })),
              error: null,
            };
          },
        };
        return query;
      },
    } as never;

    const result = await splitRowsByBrandRoster(sb, 'brand-a', [
      row('shared'),
      row('other-brand-only'),
      row('new-handle'),
    ]);

    expect(eqCalls).toEqual([['brand_id', 'brand-a']]);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((item) => item.handle)).toEqual(['other-brand-only', 'new-handle']);
  });

  it('fails closed when the roster precheck query fails', async () => {
    const sb = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          async in() {
            return { data: null, error: { message: 'database unavailable' } };
          },
        };
      },
    } as never;

    await expect(splitRowsByBrandRoster(sb, 'brand-a', [row('creator')])).rejects.toThrow(
      'roster_precheck_failed',
    );
  });
});
