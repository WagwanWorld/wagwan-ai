import type { SupabaseClient } from '@supabase/supabase-js';

type CreatorRow = { handle: string };
type ExistingRosterRow = { ig_username: string | null };

export async function splitRowsByBrandRoster<T extends CreatorRow>(
  sb: SupabaseClient,
  brandId: string,
  rows: T[],
): Promise<{ toProcess: T[]; alreadyInRoster: number }> {
  if (rows.length === 0) {
    return { toProcess: [], alreadyInRoster: 0 };
  }

  const handles = rows.map((row) => row.handle);
  const { data, error } = await sb
    .from('brand_creator_roster')
    .select('ig_username')
    .eq('brand_id', brandId)
    .in('ig_username', handles);

  if (error) {
    throw new Error('roster_precheck_failed');
  }

  const existingSet = new Set(
    ((data ?? []) as ExistingRosterRow[]).map((row) => row.ig_username).filter(Boolean),
  );

  const toProcess: T[] = [];
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
