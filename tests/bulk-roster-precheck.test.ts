import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 1, handle, custom_fields: {} };
}

function supabaseWithExisting(existing: string[]) {
  const calls: Array<{ column: string; value: string }> = [];
  return {
    calls,
    client: {
      from() {
        const query = {
          select() {
            return query;
          },
          eq(column: string, value: string) {
            calls.push({ column, value });
            return query;
          },
          in() {
            return Promise.resolve({
              data: existing.map((ig_username) => ({ ig_username })),
              error: null,
            });
          },
        };
        return query;
      },
    },
  };
}

describe('splitRowsByBrandRoster', () => {
  it('checks duplicates only within the resolved brand roster', async () => {
    const fake = supabaseWithExisting(['creator_a']);

    const result = await splitRowsByBrandRoster(fake.client as never, 'brand-1', [
      row('creator_a'),
      row('creator_b'),
    ]);

    expect(fake.calls).toContainEqual({ column: 'brand_id', value: 'brand-1' });
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['creator_b']);
  });
});
