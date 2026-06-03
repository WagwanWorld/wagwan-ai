import type { ParsedCreatorRow } from './sheetParser';

type ExistingRosterRow = {
  ig_username: string | null;
};

type RosterLookupClient = {
  from(table: 'brand_creator_roster'): {
    select(columns: 'ig_username'): {
      eq(column: 'brand_id', value: string): {
        in(
          column: 'ig_username',
          values: string[],
        ): Promise<{ data: ExistingRosterRow[] | null; error?: { message?: string } | null }>;
      };
    };
  };
};

export async function splitRowsByExistingRoster<T extends Pick<ParsedCreatorRow, 'handle'>>(
  sb: RosterLookupClient,
  brandId: string,
  rows: T[],
): Promise<{ alreadyInRoster: number; toProcess: T[] }> {
  if (rows.length === 0) {
    return { alreadyInRoster: 0, toProcess: [] };
  }

  const handles = rows.map((row) => row.handle);
  const { data: existingRows, error } = await sb
    .from('brand_creator_roster')
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  if (error) {
    throw new Error(error.message || 'roster_lookup_failed');
  }

  const existingSet = new Set(
    (existingRows ?? [])
      .map((row) => row.ig_username)
      .filter((handle): handle is string => Boolean(handle)),
  );

  const toProcess: T[] = [];
  let alreadyInRoster = 0;
  for (const row of rows) {
    if (existingSet.has(row.handle)) {
      alreadyInRoster++;
    } else {
      toProcess.push(row);
    }
  }

  return { alreadyInRoster, toProcess };
}
