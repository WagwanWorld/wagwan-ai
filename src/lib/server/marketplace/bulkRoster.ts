import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedCreatorRow } from './sheetParser';

export async function findExistingRosterHandles(
  sb: Pick<SupabaseClient, 'from'>,
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

  return new Set((data ?? []).map((r: { ig_username: string }) => r.ig_username));
}

export function mergeSheetDataIntoSnapshot(
  profile: Record<string, unknown>,
  row: ParsedCreatorRow,
): Record<string, unknown> {
  const snapshot = { ...profile };
  if (row.email) snapshot.email = row.email;
  if (row.phone) snapshot.phone = row.phone;
  if (row.rates) snapshot.rates = row.rates;
  if (row.notes) snapshot.notes = row.notes;
  if (row.tags) snapshot.tags = row.tags;
  if (row.location) snapshot.location = row.location;
  if (Object.keys(row.custom_fields).length > 0) {
    snapshot.custom_fields = row.custom_fields;
  }
  return snapshot;
}
