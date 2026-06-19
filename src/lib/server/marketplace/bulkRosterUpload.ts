import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedCreatorRow } from './sheetParser';

export type ExistingRosterFilterResult = {
  alreadyInRoster: number;
  toProcess: ParsedCreatorRow[];
};

export async function filterRowsAlreadyInBrandRoster(
  sb: SupabaseClient,
  brandId: string,
  validRows: ParsedCreatorRow[],
): Promise<ExistingRosterFilterResult> {
  if (validRows.length === 0) {
    return { alreadyInRoster: 0, toProcess: [] };
  }

  const handles = validRows.map((r) => r.handle);
  const { data: existingRows } = await sb
    .from('brand_creator_roster')
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  const existingSet = new Set(
    (existingRows ?? []).map((r: { ig_username: string }) => r.ig_username),
  );

  let alreadyInRoster = 0;
  const toProcess: ParsedCreatorRow[] = [];

  for (const row of validRows) {
    if (existingSet.has(row.handle)) {
      alreadyInRoster++;
    } else {
      toProcess.push(row);
    }
  }

  return { alreadyInRoster, toProcess };
}
