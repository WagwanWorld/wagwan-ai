/**
 * Supabase helpers for creator marketplace: rates, visibility, brief responses,
 * and the simulated payout ledger.
 *
 * Canonical request state machine (see supabase/011_flow_hardening.sql):
 *   sent -> accepted -> live -> completed
 *   sent -> declined
 *
 * Earnings ledger statuses: pending -> available -> withdrawn (plus legacy 'paid').
 */
import { getServiceSupabase } from './supabase';

export type { BriefStatus, EarningStatus } from './flowState';
export {
  BRIEF_TRANSITIONS,
  EARNING_TRANSITIONS,
  canTransitionBrief,
  canTransitionEarning,
  isCampaignUuid,
} from './flowState';
import type { BriefStatus } from './flowState';

export interface CreatorRates {
  ig_post_rate_inr: number;
  ig_story_rate_inr: number;
  ig_reel_rate_inr: number;
  whatsapp_intro_rate_inr: number;
  available: boolean;
}

export interface PortraitVisibility {
  music_visible: boolean;
  instagram_visible: boolean;
  career_visible: boolean;
  lifestyle_visible: boolean;
  calendar_visible: boolean;
  email_visible: boolean;
}

export interface BriefResponse {
  id: number;
  campaign_id: string;
  user_google_sub: string;
  status: BriefStatus;
  ig_post_url: string | null;
  accepted_at: string | null;
  live_at: string | null;
  completed_at: string | null;
  paid_at: string | null;
  payout_inr: number;
  created_at: string;
  updated_at: string;
}

export async function getRates(sub: string): Promise<CreatorRates | null> {
  const { data, error } = await getServiceSupabase()
    .from('creator_rates')
    .select('*')
    .eq('user_google_sub', sub)
    .single();
  if (error && error.code !== 'PGRST116')
    console.error('[creatorMarketplace] getRates:', error.message);
  return data
    ? {
        ig_post_rate_inr: data.ig_post_rate_inr,
        ig_story_rate_inr: data.ig_story_rate_inr,
        ig_reel_rate_inr: data.ig_reel_rate_inr,
        whatsapp_intro_rate_inr: data.whatsapp_intro_rate_inr,
        available: data.available,
      }
    : null;
}

export async function upsertRates(sub: string, rates: Partial<CreatorRates>): Promise<boolean> {
  const { error } = await getServiceSupabase()
    .from('creator_rates')
    .upsert(
      { user_google_sub: sub, ...rates, updated_at: new Date().toISOString() },
      { onConflict: 'user_google_sub' },
    );
  if (error) console.error('[creatorMarketplace] upsertRates:', error.message);
  return !error;
}

export async function getVisibility(sub: string): Promise<PortraitVisibility | null> {
  const { data, error } = await getServiceSupabase()
    .from('portrait_visibility')
    .select('*')
    .eq('user_google_sub', sub)
    .single();
  if (error && error.code !== 'PGRST116')
    console.error('[creatorMarketplace] getVisibility:', error.message);
  return data
    ? {
        music_visible: data.music_visible,
        instagram_visible: data.instagram_visible,
        career_visible: data.career_visible,
        lifestyle_visible: data.lifestyle_visible,
        calendar_visible: data.calendar_visible,
        email_visible: data.email_visible,
      }
    : null;
}

export async function upsertVisibility(
  sub: string,
  vis: Partial<PortraitVisibility>,
): Promise<boolean> {
  const { error } = await getServiceSupabase()
    .from('portrait_visibility')
    .upsert(
      { user_google_sub: sub, ...vis, updated_at: new Date().toISOString() },
      { onConflict: 'user_google_sub' },
    );
  if (error) console.error('[creatorMarketplace] upsertVisibility:', error.message);
  return !error;
}

/**
 * Accept or decline a brief. Campaign ids are UUIDs (see
 * supabase/011_flow_hardening.sql); do NOT coerce to Number.
 */
export async function respondToBrief(
  sub: string,
  campaignId: string,
  action: 'accept' | 'decline',
): Promise<BriefResponse | null> {
  const now = new Date().toISOString();
  const status: BriefStatus = action === 'accept' ? 'accepted' : 'declined';
  const { data, error } = await getServiceSupabase()
    .from('brief_responses')
    .upsert(
      {
        campaign_id: campaignId,
        user_google_sub: sub,
        status,
        accepted_at: action === 'accept' ? now : null,
        updated_at: now,
      },
      { onConflict: 'campaign_id,user_google_sub' },
    )
    .select()
    .single();
  if (error) console.error('[creatorMarketplace] respondToBrief:', error.message);
  return (data as BriefResponse | null) ?? null;
}

/**
 * Brand-side transition: mark an accepted brief as live.
 * Idempotent; only transitions rows currently in 'accepted'.
 */
export async function markBriefLive(campaignId: string, userSub?: string): Promise<number> {
  const now = new Date().toISOString();
  const query = getServiceSupabase()
    .from('brief_responses')
    .update({ status: 'live', live_at: now, updated_at: now })
    .eq('campaign_id', campaignId)
    .eq('status', 'accepted');
  if (userSub) query.eq('user_google_sub', userSub);
  const { data, error } = await query.select('id');
  if (error) {
    console.error('[creatorMarketplace] markBriefLive:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Creator-side transition: brief delivered (IG post URL submitted).
 * Returns true if a row moved from live/accepted to completed, and credits a
 * pending earnings row for the campaign reward.
 */
export async function completeBrief(
  sub: string,
  campaignId: string,
  igPostUrl: string,
): Promise<boolean> {
  const sb = getServiceSupabase();
  const now = new Date().toISOString();
  const { data: updated, error } = await sb
    .from('brief_responses')
    .update({
      status: 'completed',
      ig_post_url: igPostUrl,
      completed_at: now,
      updated_at: now,
    })
    .eq('campaign_id', campaignId)
    .eq('user_google_sub', sub)
    .in('status', ['accepted', 'live'])
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[creatorMarketplace] completeBrief:', error.message);
    return false;
  }
  if (!updated) return false;

  await creditPendingEarnings(sub, campaignId);
  return true;
}

/**
 * Insert a pending earnings row for (user, campaign) based on the campaign
 * reward. Idempotent: skips insert if a pending/available/withdrawn row
 * already exists for the pair.
 */
export async function creditPendingEarnings(sub: string, campaignId: string): Promise<boolean> {
  const sb = getServiceSupabase();

  const { data: existing } = await sb
    .from('user_earnings')
    .select('id')
    .eq('user_google_sub', sub)
    .eq('campaign_id', campaignId)
    .limit(1);
  if (existing && existing.length > 0) return true;

  const { data: camp, error: campErr } = await sb
    .from('campaigns')
    .select('reward_inr, title')
    .eq('id', campaignId)
    .maybeSingle();
  if (campErr) {
    console.error('[creatorMarketplace] creditPendingEarnings lookup:', campErr.message);
    return false;
  }
  const reward = Number(camp?.reward_inr ?? 0);
  if (!(reward > 0)) return true;

  const { error } = await sb.from('user_earnings').insert({
    user_google_sub: sub,
    campaign_id: campaignId,
    amount_inr: reward,
    status: 'pending',
    note: `Campaign completed — pending settlement${camp?.title ? ` (${camp.title})` : ''}`,
  });
  if (error) {
    console.error('[creatorMarketplace] creditPendingEarnings insert:', error.message);
    return false;
  }
  return true;
}

/**
 * Move a user's pending rows older than `minAgeSeconds` to 'available'.
 * Simulated settlement for dev/demo until a real payments webhook exists.
 * Returns the count of rows updated.
 */
export async function settlePendingEarnings(sub: string, minAgeSeconds = 0): Promise<number> {
  const cutoff = new Date(Date.now() - minAgeSeconds * 1000).toISOString();
  const { data, error } = await getServiceSupabase()
    .from('user_earnings')
    .update({ status: 'available' })
    .eq('user_google_sub', sub)
    .eq('status', 'pending')
    .lte('created_at', cutoff)
    .select('id');
  if (error) {
    console.error('[creatorMarketplace] settlePendingEarnings:', error.message);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Mark all 'available' rows for a user as 'withdrawn' and return the total
 * amount withdrawn. Simulated (no real payout).
 */
export async function withdrawAvailableEarnings(
  sub: string,
): Promise<{ amount: number; rowIds: number[] }> {
  const sb = getServiceSupabase();
  const { data: rows, error: selErr } = await sb
    .from('user_earnings')
    .select('id, amount_inr')
    .eq('user_google_sub', sub)
    .eq('status', 'available');
  if (selErr) {
    console.error('[creatorMarketplace] withdrawAvailableEarnings select:', selErr.message);
    return { amount: 0, rowIds: [] };
  }
  const list = rows ?? [];
  if (list.length === 0) return { amount: 0, rowIds: [] };

  const ids = list.map((r) => r.id as number);
  const total = list.reduce((sum, r) => sum + Number(r.amount_inr ?? 0), 0);

  const { error: updErr } = await sb
    .from('user_earnings')
    .update({ status: 'withdrawn' })
    .in('id', ids);
  if (updErr) {
    console.error('[creatorMarketplace] withdrawAvailableEarnings update:', updErr.message);
    return { amount: 0, rowIds: [] };
  }
  return { amount: Math.round(total * 100) / 100, rowIds: ids };
}

export async function getUserBriefs(sub: string): Promise<BriefResponse[]> {
  const { data } = await getServiceSupabase()
    .from('brief_responses')
    .select('*')
    .eq('user_google_sub', sub)
    .order('created_at', { ascending: false });
  return (data as BriefResponse[] | null) ?? [];
}
