import type { SupabaseClient } from '@supabase/supabase-js';
import type { ParsedCreatorRow } from './sheetParser';

export async function findExistingRosterHandles(
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
    console.error('[bulk-roster] existing handle lookup failed:', error.message);
    throw new Error('roster_lookup_failed');
  }

  return new Set((data ?? []).map((r: { ig_username: string }) => r.ig_username));
}

export function mergeSheetMetadataIntoSnapshot(
  snapshot: Record<string, unknown>,
  row: ParsedCreatorRow,
): Record<string, unknown> {
  const merged = { ...snapshot };
  if (row.email) merged.email = row.email;
  if (row.phone) merged.phone = row.phone;
  if (row.rates) merged.rates = row.rates;
  if (row.notes) merged.notes = row.notes;
  if (row.tags) merged.tags = row.tags;
  if (row.location) merged.location = row.location;
  if (Object.keys(row.custom_fields).length > 0) {
    merged.custom_fields = row.custom_fields;
  }
  return merged;
}
