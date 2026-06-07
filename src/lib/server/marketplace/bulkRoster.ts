import type { ParsedCreatorRow } from './sheetParser';

type RosterLookupClient = {
  from(table: string): unknown;
};

type RosterLookupQuery = {
  select(columns: 'ig_username'): {
    eq(
      column: 'brand_id',
      value: string,
    ): {
      in(
        column: 'ig_username',
        values: string[],
      ): PromiseLike<{ data: Array<{ ig_username: string }> | null }>;
    };
  };
};

export type BrandRosterFilterResult = {
  alreadyInRoster: number;
  toProcess: ParsedCreatorRow[];
};

export async function filterRowsAlreadyInBrandRoster(
  sb: RosterLookupClient,
  brandId: string,
  validRows: ParsedCreatorRow[],
): Promise<BrandRosterFilterResult> {
  if (validRows.length === 0) {
    return { alreadyInRoster: 0, toProcess: [] };
  }

  const handles = validRows.map((row) => row.handle);
  const query = sb.from('brand_creator_roster') as RosterLookupQuery;
  const { data: existingRows } = await query
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  const existingSet = new Set((existingRows ?? []).map((row) => row.ig_username));
  const toProcess: ParsedCreatorRow[] = [];
  let alreadyInRoster = 0;

  for (const row of validRows) {
    if (existingSet.has(row.handle)) {
      alreadyInRoster++;
    } else {
      toProcess.push(row);
    }
  }

  return { alreadyInRoster, toProcess };
}
