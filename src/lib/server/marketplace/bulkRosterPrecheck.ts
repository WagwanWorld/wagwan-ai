import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedCreatorRow } from './sheetParser';

export async function splitRowsByBrandRoster(
  sb: SupabaseClient,
  brandId: string,
  rows: ParsedCreatorRow[],
): Promise<{ toProcess: ParsedCreatorRow[]; alreadyInRoster: number }> {
  if (rows.length === 0) {
    return { toProcess: [], alreadyInRoster: 0 };
  }

  const handles = rows.map((r) => r.handle);
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
  const toProcess = rows.filter((row) => !existingSet.has(row.handle));

  return {
    toProcess,
    alreadyInRoster: rows.length - toProcess.length,
  };
}
