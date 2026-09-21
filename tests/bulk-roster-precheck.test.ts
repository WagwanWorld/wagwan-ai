import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';

describe('splitRowsByBrandRoster', () => {
  it('checks existing handles only within the authenticated brand roster', async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const query = {
      select(...args: unknown[]) {
        calls.push({ method: 'select', args });
        return query;
      },
      eq(...args: unknown[]) {
        calls.push({ method: 'eq', args });
        return query;
      },
      in(...args: unknown[]) {
        calls.push({ method: 'in', args });
        return Promise.resolve({
          data: [{ ig_username: 'samehandle' }],
          error: null,
        });
      },
    };
    const sb = {
      from(table: string) {
        calls.push({ method: 'from', args: [table] });
        return query;
      },
    };

    const result = await splitRowsByBrandRoster(sb as never, 'brand-b', [
      { handle: 'samehandle' },
      { handle: 'newhandle' },
    ]);

    expect(calls).toContainEqual({ method: 'eq', args: ['brand_id', 'brand-b'] });
    expect(calls).toContainEqual({
      method: 'in',
      args: ['ig_username', ['samehandle', 'newhandle']],
    });
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess).toEqual([{ handle: 'newhandle' }]);
  });
});
