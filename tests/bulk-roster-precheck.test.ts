import { describe, expect, it, vi } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

describe('splitRowsByBrandRoster', () => {
  it('scopes duplicate checks to the resolved brand', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({
        data: [{ ig_username: 'already_here' }],
        error: null,
      }),
    };
    const sb = { from: vi.fn(() => query) };
    const rows: ParsedCreatorRow[] = [
      { row: 2, handle: 'already_here', custom_fields: {} },
      { row: 3, handle: 'new_creator', custom_fields: {} },
    ];

    const result = await splitRowsByBrandRoster(sb as never, 'brand-1', rows);

    expect(sb.from).toHaveBeenCalledWith('brand_creator_roster');
    expect(query.eq).toHaveBeenCalledWith('brand_id', 'brand-1');
    expect(query.in).toHaveBeenCalledWith('ig_username', ['already_here', 'new_creator']);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['new_creator']);
  });

  it('fails closed when the precheck query errors', async () => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({ data: null, error: new Error('db failed') }),
    };
    const sb = { from: vi.fn(() => query) };

    await expect(
      splitRowsByBrandRoster(sb as never, 'brand-1', [
        { row: 2, handle: 'creator', custom_fields: {} },
      ]),
    ).rejects.toThrow('roster_precheck_failed');
  });
});
