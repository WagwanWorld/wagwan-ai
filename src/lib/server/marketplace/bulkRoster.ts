import type { SupabaseClient } from '@supabase/supabase-js';

export async function getExistingRosterHandlesForBrand(
  sb: SupabaseClient,
  brandId: string,
  handles: string[],
): Promise<Set<string>> {
  if (handles.length === 0) return new Set();

  const { data: existingRows } = await sb
    .from('brand_creator_roster')
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  return new Set((existingRows ?? []).map((r: { ig_username: string }) => r.ig_username));
}
