import { describe, expect, it } from 'vitest';
import { splitRowsByBrandRoster } from '../src/lib/server/marketplace/bulkRosterPrecheck';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

function row(handle: string): ParsedCreatorRow {
  return { row: 2, handle, custom_fields: {} };
}

describe('splitRowsByBrandRoster', () => {
  it('only skips handles that already exist for the authenticated brand', () => {
    const result = splitRowsByBrandRoster(
      [row('shared_creator'), row('own_creator'), row('new_creator')],
      [
        { brand_id: 'other-brand', ig_username: 'shared_creator' },
        { brand_id: 'brand-1', ig_username: 'own_creator' },
      ],
      'brand-1',
    );

    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((r) => r.handle)).toEqual(['shared_creator', 'new_creator']);
  });
});
