import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedCreatorRow } from './sheetParser';

export type BulkRosterFilterResult = {
  alreadyInRoster: number;
  toProcess: ParsedCreatorRow[];
};

export async function filterRowsAlreadyInBrandRoster(
  sb: SupabaseClient,
  brandId: string,
  valid: ParsedCreatorRow[],
): Promise<BulkRosterFilterResult> {
  if (valid.length === 0) {
    return { alreadyInRoster: 0, toProcess: [] };
  }

  const handles = valid.map((r) => r.handle);
  const { data: existingRows } = await sb
    .from('brand_creator_roster')
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  const existingSet = new Set(
    (existingRows ?? []).map((r: { ig_username: string }) => r.ig_username),
  );
  const toProcess = valid.filter((row) => !existingSet.has(row.handle));

  return {
    alreadyInRoster: valid.length - toProcess.length,
    toProcess,
  };
}
