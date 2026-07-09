import { describe, expect, it } from 'vitest';
import { splitRowsByExistingBrandRoster } from '../src/lib/server/marketplace/bulkRoster';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 2, handle, custom_fields: {} };
}

describe('splitRowsByExistingBrandRoster', () => {
  it('only skips handles that already exist for the same brand', () => {
    const result = splitRowsByExistingBrandRoster(
      [row('creatorone'), row('creatortwo'), row('creatorthree')],
      [
        { brand_id: 'brand-a', ig_username: 'creatorone' },
        { brand_id: 'brand-b', ig_username: 'creatortwo' },
      ],
      'brand-b',
    );

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['creatorone', 'creatorthree']);
  });
});
