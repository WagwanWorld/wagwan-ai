import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedCreatorRow } from './sheetParser';

export async function partitionRowsByRosterMembership(
  sb: SupabaseClient,
  brandId: string,
  rows: ParsedCreatorRow[],
): Promise<{ toProcess: ParsedCreatorRow[]; alreadyInRoster: number }> {
  if (rows.length === 0) {
    return { toProcess: [], alreadyInRoster: 0 };
  }

  const handles = rows.map((row) => row.handle);
  const { data: existingRows, error } = await sb
    .from('brand_creator_roster')
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  if (error) {
    throw new Error('roster_lookup_failed');
  }

  const existingSet = new Set(
    (existingRows ?? []).map((row: { ig_username: string }) => row.ig_username),
  );

  const toProcess: ParsedCreatorRow[] = [];
  let alreadyInRoster = 0;
  for (const row of rows) {
    if (existingSet.has(row.handle)) {
      alreadyInRoster++;
    } else {
      toProcess.push(row);
    }
  }

  return { toProcess, alreadyInRoster };
}
