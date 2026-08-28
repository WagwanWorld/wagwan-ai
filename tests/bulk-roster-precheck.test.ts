import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 1, handle, custom_fields: {} };
}

describe('splitRowsByBrandRoster', () => {
  it('checks existing creators within the authenticated brand only', async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const query = {
      select: (...args: unknown[]) => {
        calls.push({ method: 'select', args });
        return query;
      },
      eq: (...args: unknown[]) => {
        calls.push({ method: 'eq', args });
        return query;
      },
      in: async (...args: unknown[]) => {
        calls.push({ method: 'in', args });
        return { data: [{ ig_username: 'already_here' }], error: null };
      },
    };
    const sb = { from: () => query };

    const result = await splitRowsByBrandRoster(sb as never, 'brand-1', [
      row('already_here'),
      row('new_creator'),
    ]);

    expect(calls).toContainEqual({ method: 'eq', args: ['brand_id', 'brand-1'] });
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['new_creator']);
  });
});
