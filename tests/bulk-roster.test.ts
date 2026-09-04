import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 2, handle, custom_fields: {} };
}

describe('splitRowsByBrandRoster', () => {
  it('only skips existing handles for the active brand', () => {
    const result = splitRowsByBrandRoster(
      [row('sharedcreator'), row('owncreator')],
      [
        { brand_id: 'brand-other', ig_username: 'sharedcreator' },
        { brand_id: 'brand-active', ig_username: 'owncreator' },
      ],
      'brand-active',
    );

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['sharedcreator']);
  });
});
