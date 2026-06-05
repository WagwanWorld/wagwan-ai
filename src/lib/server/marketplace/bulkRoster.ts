import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedCreatorRow } from './sheetParser';

export type RosterPartition = {
  alreadyInRoster: number;
  toProcess: ParsedCreatorRow[];
};

/**
 * Split upload rows by existing roster membership for the authenticated brand only.
 */
export async function partitionRowsByBrandRoster(
  sb: SupabaseClient,
  brandId: string,
  validRows: ParsedCreatorRow[],
): Promise<RosterPartition> {
  if (validRows.length === 0) {
    return { alreadyInRoster: 0, toProcess: [] };
  }

  const handles = validRows.map((r) => r.handle);
  const { data: existingRows, error } = await sb
    .from('brand_creator_roster')
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  if (error) {
    throw new Error('roster_lookup_failed');
  }

  const existingSet = new Set((existingRows ?? []).map((r) => r.ig_username as string));
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
