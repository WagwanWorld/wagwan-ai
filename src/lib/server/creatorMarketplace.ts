/**
 * Supabase helpers for creator marketplace: rates, visibility, brief responses.
 */
import { getServiceSupabase } from './supabase';

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
  campaign_id: number;
  user_google_sub: string;
  status: string;
  ig_post_url: string | null;
  accepted_at: string | null;
  completed_at: string | null;
  paid_at: string | null;
  payout_inr: number;
  created_at: string;
}

export async function getRates(sub: string): Promise<CreatorRates | null> {
  const { data, error } = await getServiceSupabase()
    .from('creator_rates').select('*').eq('user_google_sub', sub).single();
  if (error && error.code !== 'PGRST116') console.error('[creatorMarketplace] getRates:', error.message);
  return data ? {
    ig_post_rate_inr: data.ig_post_rate_inr,
    ig_story_rate_inr: data.ig_story_rate_inr,
    ig_reel_rate_inr: data.ig_reel_rate_inr,
    whatsapp_intro_rate_inr: data.whatsapp_intro_rate_inr,
    available: data.available,
  } : null;
}

export async function upsertRates(sub: string, rates: Partial<CreatorRates>): Promise<boolean> {
  const { error } = await getServiceSupabase()
    .from('creator_rates').upsert({
      user_google_sub: sub, ...rates, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_google_sub' });
  if (error) console.error('[creatorMarketplace] upsertRates:', error.message);
  return !error;
}

export async function getVisibility(sub: string): Promise<PortraitVisibility | null> {
  const { data, error } = await getServiceSupabase()
    .from('portrait_visibility').select('*').eq('user_google_sub', sub).single();
  if (error && error.code !== 'PGRST116') console.error('[creatorMarketplace] getVisibility:', error.message);
  return data ? {
    music_visible: data.music_visible,
    instagram_visible: data.instagram_visible,
    career_visible: data.career_visible,
    lifestyle_visible: data.lifestyle_visible,
    calendar_visible: data.calendar_visible,
    email_visible: data.email_visible,
  } : null;
}

export async function upsertVisibility(sub: string, vis: Partial<PortraitVisibility>): Promise<boolean> {
  const { error } = await getServiceSupabase()
    .from('portrait_visibility').upsert({
      user_google_sub: sub, ...vis, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_google_sub' });
  if (error) console.error('[creatorMarketplace] upsertVisibility:', error.message);
  return !error;
}

export async function respondToBrief(
  sub: string, campaignId: number, action: 'accept' | 'decline'
): Promise<BriefResponse | null> {
  const now = new Date().toISOString();
  const { data, error } = await getServiceSupabase()
    .from('brief_responses').upsert({
      campaign_id: campaignId,
      user_google_sub: sub,
      status: action === 'accept' ? 'accepted' : 'declined',
      accepted_at: action === 'accept' ? now : null,
      created_at: now,
    }, { onConflict: 'campaign_id,user_google_sub' }).select().single();
  if (error) console.error('[creatorMarketplace] respondToBrief:', error.message);
  return data ?? null;
}

export async function completeBrief(
  sub: string, campaignId: number, igPostUrl: string
): Promise<boolean> {
  const { error } = await getServiceSupabase()
    .from('brief_responses')
    .update({ status: 'completed', ig_post_url: igPostUrl, completed_at: new Date().toISOString() })
    .eq('campaign_id', campaignId).eq('user_google_sub', sub).eq('status', 'accepted');
  if (error) console.error('[creatorMarketplace] completeBrief:', error.message);
  return !error;
}

export async function getUserBriefs(sub: string): Promise<BriefResponse[]> {
  const { data } = await getServiceSupabase()
    .from('brief_responses').select('*').eq('user_google_sub', sub).order('created_at', { ascending: false });
  return data ?? [];
}
