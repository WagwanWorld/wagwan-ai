import { describe, it, expect, vi } from 'vitest';
import {
  loadExistingBrandRosterHandles,
  partitionRowsByExistingRoster,
} from '../src/lib/server/marketplace/bulkRosterUpload';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

describe('bulk roster upload helpers', () => {
  it('looks up existing roster handles within the current brand only', async () => {
    const inMock = vi.fn().mockResolvedValue({
      data: [{ ig_username: 'creator_a' }],
      error: null,
    });
    const eqMock = vi.fn(() => ({ in: inMock }));
    const selectMock = vi.fn(() => ({ eq: eqMock }));
    const fromMock = vi.fn(() => ({ select: selectMock }));

    const handles = await loadExistingBrandRosterHandles(
      { from: fromMock },
      'brand-current',
      ['creator_a', 'creator_b'],
    );

    expect(fromMock).toHaveBeenCalledWith('brand_creator_roster');
    expect(selectMock).toHaveBeenCalledWith('ig_username');
    expect(eqMock).toHaveBeenCalledWith('brand_id', 'brand-current');
    expect(inMock).toHaveBeenCalledWith('ig_username', ['creator_a', 'creator_b']);
    expect([...handles]).toEqual(['creator_a']);
  });

  it('keeps rows whose handles only exist outside the current brand', () => {
    const rows: ParsedCreatorRow[] = [
      { row: 2, handle: 'creator_a', custom_fields: {} },
      { row: 3, handle: 'creator_b', custom_fields: {} },
    ];

    const result = partitionRowsByExistingRoster(rows, new Set(['creator_a']));

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((row) => row.handle)).toEqual(['creator_b']);
  });
});
