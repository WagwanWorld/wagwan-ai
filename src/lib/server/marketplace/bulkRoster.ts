import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';

export async function getExistingRosterHandlesForBrand(
  sb: SupabaseClient,
  brandId: string,
  handles: string[],
): Promise<Set<string>> {
  if (handles.length === 0) return new Set();

  const { data, error: lookupError } = await sb
    .from('brand_creator_roster')
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  if (lookupError) {
    console.error('[creator-roster-bulk] existing lookup', lookupError.message);
    throw error(500, 'Could not check existing roster entries');
  }

  return new Set((data ?? []).map((r: { ig_username: string }) => r.ig_username));
}
