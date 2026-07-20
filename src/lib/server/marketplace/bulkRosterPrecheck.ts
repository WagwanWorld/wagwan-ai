import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedCreatorRow } from './sheetParser';

export type BulkRosterPrecheckResult = {
  alreadyInRoster: number;
  toProcess: ParsedCreatorRow[];
};

export async function splitRowsByBrandRoster(
  sb: SupabaseClient,
  brandId: string,
  valid: ParsedCreatorRow[],
): Promise<BulkRosterPrecheckResult> {
  if (valid.length === 0) {
    return { alreadyInRoster: 0, toProcess: [] };
  }

  const handles = Array.from(new Set(valid.map((r) => r.handle)));
  const { data: existingRows, error } = await sb
    .from('brand_creator_roster')
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  if (error) {
    throw new Error('roster_precheck_failed');
  }

  const existingSet = new Set(
    (existingRows ?? []).map((r: { ig_username: string }) => r.ig_username),
  );
  const toProcess: ParsedCreatorRow[] = [];
  let alreadyInRoster = 0;

  for (const row of valid) {
    if (existingSet.has(row.handle)) {
      alreadyInRoster++;
    } else {
      toProcess.push(row);
    }
  }

  return { alreadyInRoster, toProcess };
}
