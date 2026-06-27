import type { SupabaseClient } from '@supabase/supabase-js';

export async function listExistingRosterHandlesForBrand(
  sb: SupabaseClient,
  brandId: string,
  handles: string[],
): Promise<Set<string>> {
  if (handles.length === 0) return new Set();

  const { data } = await sb
    .from('brand_creator_roster')
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  return new Set((data ?? []).map((r: { ig_username: string }) => r.ig_username));
}
