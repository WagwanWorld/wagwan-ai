import { describe, expect, it, vi } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

describe('splitRowsByBrandRoster', () => {
  it('checks existing handles within the resolved brand only', async () => {
    const eq = vi.fn().mockReturnThis();
    const inFilter = vi.fn().mockResolvedValue({
      data: [{ ig_username: 'existing_creator' }],
      error: null,
    });
    const select = vi.fn().mockReturnValue({ eq, in: inFilter });
    const from = vi.fn().mockReturnValue({ select });

    const rows = [
      { row: 2, handle: 'existing_creator', custom_fields: {} },
      { row: 3, handle: 'new_creator', custom_fields: {} },
    ] as ParsedCreatorRow[];

    const result = await splitRowsByBrandRoster({ from } as never, 'brand-a', rows);

    expect(from).toHaveBeenCalledWith('brand_creator_roster');
    expect(eq).toHaveBeenCalledWith('brand_id', 'brand-a');
    expect(inFilter).toHaveBeenCalledWith('ig_username', ['existing_creator', 'new_creator']);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((row) => row.handle)).toEqual(['new_creator']);
  });
});
