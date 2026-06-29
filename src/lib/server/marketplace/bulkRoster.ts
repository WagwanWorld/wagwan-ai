import type { SupabaseClient } from '@supabase/supabase-js';

export async function getExistingRosterHandlesForBrand(
  sb: SupabaseClient,
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
    throw new Error('roster_lookup_failed');
  }

  return new Set(
    (data ?? [])
      .map((row: { ig_username?: string | null }) => row.ig_username)
      .filter((handle): handle is string => Boolean(handle)),
  );
}
