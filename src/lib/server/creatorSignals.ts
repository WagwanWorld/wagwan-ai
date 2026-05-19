import type { SupabaseClient } from '@supabase/supabase-js';
import type { CreatorBrandSignal, SignalType } from '$lib/types/creator-signals';

/**
 * Insert or update a creator brand signal.
 * On conflict (same creator + brand + signal_type), updates the message and fit data.
 */
export async function upsertCreatorBrandSignal(
  sb: SupabaseClient,
  signal: {
    creator_google_sub: string;
    signal_type: SignalType;
    brand_id: string;
    roster_entry_id?: string | null;
    brand_name: string;
    brand_handle?: string | null;
    brand_profile_picture?: string | null;
    invite_message?: string | null;
    fit_label?: string | null;
    fit_score?: number | null;
    analysis_snapshot?: Record<string, unknown>;
  },
): Promise<{ id: string } | null> {
  const { data, error } = await sb
    .from('creator_brand_signals')
    .upsert(
      {
        creator_google_sub: signal.creator_google_sub,
        signal_type: signal.signal_type,
        brand_id: signal.brand_id,
        roster_entry_id: signal.roster_entry_id ?? null,
        brand_name: signal.brand_name,
        brand_handle: signal.brand_handle ?? null,
        brand_profile_picture: signal.brand_profile_picture ?? null,
        invite_message: signal.invite_message ?? null,
        fit_label: signal.fit_label ?? null,
        fit_score: signal.fit_score ?? null,
        analysis_snapshot: signal.analysis_snapshot ?? {},
        seen: false,
        seen_at: null,
      },
      { onConflict: 'creator_google_sub,brand_id,signal_type' },
    )
    .select('id')
    .single();

  if (error) {
    console.error('[creatorSignals] upsert failed:', error.message);
    return null;
  }
  return { id: data.id as string };
}

/**
 * Fetch signals for a creator, optionally filtered.
 */
export async function listCreatorBrandSignals(
  sb: SupabaseClient,
  googleSub: string,
  opts?: { seen?: boolean; signalType?: SignalType; limit?: number },
): Promise<{ signals: CreatorBrandSignal[]; unseenCount: number }> {
  const limit = opts?.limit ?? 50;

  let query = sb
    .from('creator_brand_signals')
    .select('*')
    .eq('creator_google_sub', googleSub)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (opts?.seen !== undefined) {
    query = query.eq('seen', opts.seen);
  }
  if (opts?.signalType) {
    query = query.eq('signal_type', opts.signalType);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[creatorSignals] list failed:', error.message);
    return { signals: [], unseenCount: 0 };
  }

  const signals = (data ?? []) as CreatorBrandSignal[];

  // Count unseen (always unfiltered for badge)
  const { count } = await sb
    .from('creator_brand_signals')
    .select('id', { count: 'exact', head: true })
    .eq('creator_google_sub', googleSub)
    .eq('seen', false);

  return { signals, unseenCount: count ?? 0 };
}

/**
 * Mark one or all signals as seen.
 */
export async function markSignalsSeen(
  sb: SupabaseClient,
  googleSub: string,
  opts: { id?: string; markAllSeen?: boolean },
): Promise<boolean> {
  const now = new Date().toISOString();

  if (opts.markAllSeen) {
    const { error } = await sb
      .from('creator_brand_signals')
      .update({ seen: true, seen_at: now })
      .eq('creator_google_sub', googleSub)
      .eq('seen', false);
    return !error;
  }

  if (opts.id) {
    const { error } = await sb
      .from('creator_brand_signals')
      .update({ seen: true, seen_at: now })
      .eq('id', opts.id)
      .eq('creator_google_sub', googleSub);
    return !error;
  }

  return false;
}
