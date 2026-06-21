import type { ParsedCreatorRow } from './sheetParser';

type RosterHandleRow = { ig_username: string | null };

type RosterLookupClient = {
  from(table: 'brand_creator_roster'): {
    select(columns: 'ig_username'): {
      eq(
        column: 'brand_id',
        value: string,
      ): {
        in(
          column: 'ig_username',
          values: string[],
        ): PromiseLike<{ data: RosterHandleRow[] | null; error: { message?: string } | null }>;
      };
    };
  };
};

export async function loadExistingBrandRosterHandles(
  sb: RosterLookupClient,
  brandId: string,
  handles: string[],
): Promise<Set<string>> {
  if (handles.length === 0) return new Set();

  const { data, error } = await sb
    .from('brand_creator_roster')
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  if (error) {
    throw new Error(error.message || 'roster_lookup_failed');
  }

  return new Set(
    (data ?? []).map((row) => row.ig_username).filter((handle): handle is string => !!handle),
  );
}

export function partitionRowsByExistingRoster(
  rows: ParsedCreatorRow[],
  existingHandles: Set<string>,
): { alreadyInRoster: number; toProcess: ParsedCreatorRow[] } {
  const toProcess: ParsedCreatorRow[] = [];
  let alreadyInRoster = 0;

  for (const row of rows) {
    if (existingHandles.has(row.handle)) {
      alreadyInRoster++;
    } else {
      toProcess.push(row);
    }
  }

  return { alreadyInRoster, toProcess };
}
