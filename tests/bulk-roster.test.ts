import { describe, expect, it } from 'vitest';
import {
  filterRowsAlreadyInBrandRoster,
  type BrandRosterFilterResult,
} from '../src/lib/server/marketplace/bulkRoster';
import type { ParsedCreatorRow } from '../src/lib/server/marketplace/sheetParser';

type RosterRow = { brand_id: string; ig_username: string };

function row(handle: string): ParsedCreatorRow {
  return { row: 1, handle, custom_fields: {} };
}

function makeRosterClient(rows: RosterRow[]) {
  const filters: Array<{ column: string; value: string }> = [];
  return {
    filters,
    client: {
      from(table: 'brand_creator_roster') {
        expect(table).toBe('brand_creator_roster');
        return {
          select(columns: 'ig_username') {
            expect(columns).toBe('ig_username');
            return {
              eq(column: 'brand_id', value: string) {
                filters.push({ column, value });
                return {
                  async in(column: 'ig_username', values: string[]) {
                    expect(column).toBe('ig_username');
                    return {
                      data: rows
                        .filter((rosterRow) =>
                          filters.every((filter) => rosterRow[filter.column as keyof RosterRow] === filter.value),
                        )
                        .filter((rosterRow) => values.includes(rosterRow.ig_username))
                        .map(({ ig_username }) => ({ ig_username })),
                    };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

describe('filterRowsAlreadyInBrandRoster', () => {
  it('only skips creators that already exist for the current brand', async () => {
    const { client, filters } = makeRosterClient([
      { brand_id: 'brand-a', ig_username: 'sharedcreator' },
      { brand_id: 'brand-b', ig_username: 'owncreator' },
    ]);

    const result: BrandRosterFilterResult = await filterRowsAlreadyInBrandRoster(client, 'brand-b', [
      row('sharedcreator'),
      row('owncreator'),
    ]);

    expect(filters).toEqual([{ column: 'brand_id', value: 'brand-b' }]);
    expect(result.alreadyInRoster).toBe(1);
    expect(result.toProcess.map((creatorRow) => creatorRow.handle)).toEqual(['sharedcreator']);
  });
});
