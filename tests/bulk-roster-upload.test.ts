import { describe, expect, it } from 'vitest';
import { filterRowsAlreadyInBrandRoster } from '../src/lib/server/marketplace/bulkRosterUpload';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 1, handle, custom_fields: {} };
}

function supabaseWithRoster(rows: Array<{ brand_id: string; ig_username: string }>) {
  const calls: Array<{ op: string; column?: string; value?: unknown; values?: unknown[] }> = [];
  let scopedBrandId: string | null = null;

  return {
    calls,
    client: {
      from(table: string) {
        calls.push({ op: 'from', value: table });
        return {
          select(columns: string) {
            calls.push({ op: 'select', value: columns });
            return this;
          },
          eq(column: string, value: unknown) {
            calls.push({ op: 'eq', column, value });
            if (column === 'brand_id') scopedBrandId = String(value);
            return this;
          },
          in(column: string, values: unknown[]) {
            calls.push({ op: 'in', column, values });
            return Promise.resolve({
              data: rows
                .filter((r) => r.brand_id === scopedBrandId)
                .filter((r) => values.includes(r.ig_username))
                .map((r) => ({ ig_username: r.ig_username })),
            });
          },
        };
      },
    },
  };
}

describe('filterRowsAlreadyInBrandRoster', () => {
  it('only skips handles already present for the active brand', async () => {
    const { client, calls } = supabaseWithRoster([
      { brand_id: 'brand-a', ig_username: 'sharedcreator' },
      { brand_id: 'brand-b', ig_username: 'owncreator' },
    ]);

    const result = await filterRowsAlreadyInBrandRoster(
      client as never,
      'brand-b',
      [row('sharedcreator'), row('owncreator'), row('newcreator')],
    );

    expect(calls).toContainEqual({ op: 'eq', column: 'brand_id', value: 'brand-b' });
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['sharedcreator', 'newcreator']);
  });

  it('does not query Supabase when there are no valid rows', async () => {
    const { client, calls } = supabaseWithRoster([]);

    const result = await filterRowsAlreadyInBrandRoster(client as never, 'brand-b', []);

    expect(calls).toEqual([]);
    expect(result).toEqual({ alreadyInRoster: 0, toProcess: [] });
  });
});
