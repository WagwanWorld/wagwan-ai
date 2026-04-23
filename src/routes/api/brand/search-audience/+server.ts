import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import type { ParsedAudience } from '$lib/server/marketplace/types';
import { rankAudience, type ProfileRowForMatch } from '$lib/server/marketplace/audienceMatch';
import { env } from '$env/dynamic/private';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: {
    structured?: ParsedAudience;
    actorGoogleSub?: string;
    limit?: number;
    reward_inr?: number;
    min_score?: number;
  };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const structured = body.structured;
  if (!structured || !Array.isArray(structured.interests)) {
    throw error(400, 'structured audience is required');
  }

  const limit = Math.min(100, Math.max(1, Number(body.limit) || 50));
  const reward_inr =
    body.reward_inr != null && Number.isFinite(Number(body.reward_inr))
      ? Number(body.reward_inr)
      : null;

  const sb = getServiceSupabase();
  const { data: rows, error: qErr } = await sb
    .from('user_profiles')
    .select('google_sub, name, identity_graph, profile_data, updated_at')
    .limit(800);

  if (qErr) {
    console.error('[brand/search-audience]', qErr.message);
    throw error(500, 'Database error');
  }

  const profiles: ProfileRowForMatch[] = (rows ?? [])
    .map(r => ({
      google_sub: r.google_sub as string,
      name: (r.name as string | null) ?? null,
      identity_graph: (r.identity_graph as Record<string, unknown>) ?? {},
      profile_data: (r.profile_data as Record<string, unknown>) ?? {},
      updated_at: (r.updated_at as string | null) ?? null,
    }))
    .filter(r => Boolean(r.google_sub));

  const subs = profiles.map(p => p.google_sub);
  const manualTagsBySub = new Map<string, string[]>();
  if (subs.length > 0) {
    const { data: prefRows } = await sb
      .from('user_marketing_prefs')
      .select('user_google_sub, manual_interest_tags')
      .in('user_google_sub', subs);
    for (const pr of prefRows ?? []) {
      const sub = pr.user_google_sub as string;
      const tags = Array.isArray(pr.manual_interest_tags)
        ? (pr.manual_interest_tags as string[]).filter(Boolean)
        : [];
      if (tags.length) manualTagsBySub.set(sub, tags);
    }
  }

  // Fetch creator rates for available creators
  const ratesBySub = new Map<string, { ig_post_rate_inr: number; ig_story_rate_inr: number; ig_reel_rate_inr: number; available: boolean }>();
  if (subs.length > 0) {
    const { data: rateRows } = await sb
      .from('creator_rates')
      .select('user_google_sub, ig_post_rate_inr, ig_story_rate_inr, ig_reel_rate_inr, available')
      .in('user_google_sub', subs)
      .eq('available', true);
    for (const r of rateRows ?? []) {
      ratesBySub.set(r.user_google_sub as string, {
        ig_post_rate_inr: r.ig_post_rate_inr as number,
        ig_story_rate_inr: r.ig_story_rate_inr as number,
        ig_reel_rate_inr: r.ig_reel_rate_inr as number,
        available: true,
      });
    }
  }

  const boostRaw = (env.BRAND_RANK_STRENGTH_BOOST ?? '').trim().toLowerCase();
  const rankStrengthBoost = boostRaw === '1' || boostRaw === 'true' || boostRaw === 'yes';

  const result = rankAudience(profiles, structured, {
    limit,
    reward_inr,
    minScore: body.min_score != null ? Number(body.min_score) : 0,
    manualTagsBySub,
    rankStrengthBoost,
  });

  // Enrich results with rates. AudienceSearchUserRow uses `user_google_sub`,
  // NOT `google_sub`; prior to this fix `ratesBySub.get(u.google_sub)` always
  // returned undefined, so rates never reached the portal UI.
  const enrichedUsers = (result.users ?? []).map((u) => ({
    ...u,
    rates: ratesBySub.get(u.user_google_sub) ?? null,
  }));

  return json({ ok: true, ...result, users: enrichedUsers });
};
