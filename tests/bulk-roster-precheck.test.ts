import { describe, expect, it, vi } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 1, handle, custom_fields: {} };
}

describe('splitRowsByBrandRoster', () => {
  it('filters existing handles only within the authenticated brand roster', async () => {
    const inMock = vi.fn().mockResolvedValue({
      data: [{ ig_username: 'samebrand' }],
      error: null,
    });
    const eqMock = vi.fn(() => ({ in: inMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));

    const result = await splitRowsByBrandRoster({ from: fromMock } as never, 'brand-a', [
      row('samebrand'),
      row('otherbrand'),
    ]);

    expect(fromMock).toHaveBeenCalledWith('brand_creator_roster');
    expect(selectMock).toHaveBeenCalledWith('ig_username');
    expect(eqMock).toHaveBeenCalledWith('brand_id', 'brand-a');
    expect(inMock).toHaveBeenCalledWith('ig_username', ['samebrand', 'otherbrand']);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['otherbrand']);
  });

  it('fails closed when the existing-roster precheck errors', async () => {
    const sb = {
      from: () => ({
        select: () => ({
          eq: () => ({
            in: async () => ({ data: null, error: new Error('database unavailable') }),
          }),
        }),
      }),
    };

    await expect(splitRowsByBrandRoster(sb as never, 'brand-a', [row('creator')])).rejects.toThrow(
      'roster_precheck_failed',
    );
  });
});
