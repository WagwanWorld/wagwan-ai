import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 1, handle, custom_fields: {} };
}

function fakeSupabase(existingHandles: string[]) {
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
    in: (...args: unknown[]) => {
      calls.push({ method: 'in', args });
      return Promise.resolve({
        data: existingHandles.map((ig_username) => ({ ig_username })),
      });
    },
  };

  return {
    calls,
    client: {
      from: (...args: unknown[]) => {
        calls.push({ method: 'from', args });
        return query;
      },
    },
  };
}

describe('splitRowsByBrandRoster', () => {
  it('scopes existing roster checks to the authenticated brand', async () => {
    const sb = fakeSupabase(['samebrand']);

    const result = await splitRowsByBrandRoster(sb.client as never, 'brand-1', [
      row('samebrand'),
      row('otherbrand'),
    ]);

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['otherbrand']);
    expect(sb.calls).toContainEqual({ method: 'eq', args: ['brand_id', 'brand-1'] });
    expect(sb.calls).toContainEqual({
      method: 'in',
      args: ['ig_username', ['samebrand', 'otherbrand']],
    });
  });

  it('does not skip handles that only exist on another brand roster', async () => {
    const sb = fakeSupabase([]);

    const result = await splitRowsByBrandRoster(sb.client as never, 'brand-2', [row('shared')]);

    expect(result.alreadyInRoster).toBe(0);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['shared']);
  });
});
