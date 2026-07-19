import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedCreatorRow } from './sheetParser';

export async function splitRowsByBrandRoster(
  sb: SupabaseClient,
  brandId: string,
  valid: ParsedCreatorRow[],
): Promise<{ alreadyInRoster: number; toProcess: ParsedCreatorRow[] }> {
  let alreadyInRoster = 0;
  const toProcess: ParsedCreatorRow[] = [];

  if (valid.length === 0) {
    return { alreadyInRoster, toProcess };
  }

  const handles = valid.map((r) => r.handle);
  const { data: existingRows } = await sb
    .from('brand_creator_roster')
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  const existingSet = new Set((existingRows ?? []).map((r) => r.ig_username as string));

  for (const row of valid) {
    if (existingSet.has(row.handle)) {
      alreadyInRoster++;
    } else {
      toProcess.push(row);
    }
  }

  return { alreadyInRoster, toProcess };
}
