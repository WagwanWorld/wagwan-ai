import { describe, expect, it } from 'vitest';
import { splitRowsByExistingRoster } from '../src/lib/server/marketplace/bulkRoster';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 2, handle, custom_fields: {} };
}

describe('splitRowsByExistingRoster', () => {
  it('only skips handles that already exist for the current brand', () => {
    const brandId = 'brand-current';
    const rows = [row('sharedcreator'), row('currentcreator'), row('newcreator')];

    const result = splitRowsByExistingRoster(
      rows,
      [
        { brand_id: 'brand-other', ig_username: 'sharedcreator' },
        { brand_id: brandId, ig_username: 'currentcreator' },
      ],
      brandId,
    );

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['sharedcreator', 'newcreator']);
  });
});
