import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import type { ParsedAudience } from '$lib/server/marketplace/types';
import type { ProfileRowForMatch } from '$lib/server/marketplace/audienceMatch';
import { runBrandAudienceIntel } from '$lib/server/marketplace/inferBrandAudienceIntel';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { buildIdentityGraph, identitySummary } from '$lib/server/identity';

const MAX_MEMBERS = 32;

function isParsedAudience(x: unknown): x is ParsedAudience {
  if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
  const o = x as Record<string, unknown>;
  return Array.isArray(o.interests);
}

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: {
    structured?: unknown;
    key_traits?: unknown;
    members?: unknown;
    actorGoogleSub?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  assertBrandAccess(request, typeof body.actorGoogleSub === 'string' ? body.actorGoogleSub : null);

  if (!isParsedAudience(body.structured)) {
    throw error(400, 'structured audience is required');
  }
  const structured = body.structured;

  const keyTraitsRaw = Array.isArray(body.key_traits) ? body.key_traits : [];
  const keyTraits: { tag: string; count: number }[] = [];
  for (const item of keyTraitsRaw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const tag = typeof o.tag === 'string' ? o.tag.trim() : '';
    const count = typeof o.count === 'number' && Number.isFinite(o.count) ? Math.floor(o.count) : 0;
    if (tag) keyTraits.push({ tag, count });
  }

  const membersRaw = Array.isArray(body.members) ? body.members : [];
  const memberInputs: { user_google_sub: string; match_score: number; match_reason: string; preview_tags: string[] }[] =
    [];
  for (const item of membersRaw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const user_google_sub = typeof o.user_google_sub === 'string' ? o.user_google_sub.trim() : '';
    if (!user_google_sub) continue;
    const match_score =
      typeof o.match_score === 'number' && Number.isFinite(o.match_score) ? Number(o.match_score) : 0;
    const match_reason = typeof o.match_reason === 'string' ? o.match_reason : '';
    const preview_tags = Array.isArray(o.preview_tags)
      ? (o.preview_tags as unknown[]).filter(t => typeof t === 'string').map(t => String(t).trim()).filter(Boolean)
      : [];
    memberInputs.push({ user_google_sub, match_score, match_reason, preview_tags });
    if (memberInputs.length >= MAX_MEMBERS) break;
  }

  if (!memberInputs.length) {
    throw error(400, 'members array required');
  }

  const keyOk = Boolean((env.ANTHROPIC_API_KEY ?? '').trim());
  if (!keyOk) {
    return json({ ok: false, error: 'anthropic_not_configured' }, { status: 503 });
  }

  const subs = [...new Set(memberInputs.map(m => m.user_google_sub))];
  const sb = getServiceSupabase();
  const { data: rows, error: qErr } = await sb
    .from('user_profiles')
    .select('google_sub, name, identity_graph, profile_data, updated_at')
    .in('google_sub', subs);

  if (qErr) {
    console.error('[brand/audience-intelligence]', qErr.message);
    throw error(500, 'Database error');
  }

  const bySub = new Map((rows ?? []).map(r => [r.google_sub as string, r]));
  const manualTagsBySub = new Map<string, string[]>();
  if (subs.length) {
    const { data: prefRows } = await sb
      .from('user_marketing_prefs')
      .select('user_google_sub, manual_interest_tags')
      .in('user_google_sub', subs);
    for (const pr of prefRows ?? []) {
      const s = pr.user_google_sub as string;
      const tags = Array.isArray(pr.manual_interest_tags)
        ? (pr.manual_interest_tags as string[]).filter(Boolean)
        : [];
      if (tags.length) manualTagsBySub.set(s, tags);
    }
  }

  const profiles: ProfileRowForMatch[] = [];
  const memberExtras = new Map<
    string,
    { match_score: number; match_reason: string; preview_tags: string[]; identity_summary: string }
  >();

  const sortedInputs = [...memberInputs].sort((a, b) => b.match_score - a.match_score);

  for (const m of sortedInputs) {
    const r = bySub.get(m.user_google_sub);
    if (!r) continue;

    const manualInterestTags = manualTagsBySub.get(m.user_google_sub) ?? [];
    const profileData = r.profile_data as Record<string, unknown>;
    const merged: Record<string, unknown> = {
      ...profileData,
      ...(manualInterestTags.length ? { manualInterestTags } : {}),
    };
    const graph = buildIdentityGraph(merged);
    const identity_summary = identitySummary(graph);

    profiles.push({
      google_sub: m.user_google_sub,
      name: (r.name as string | null) ?? null,
      identity_graph: (r.identity_graph as Record<string, unknown>) ?? {},
      profile_data: profileData,
      updated_at: (r.updated_at as string | null) ?? null,
    });
    memberExtras.set(m.user_google_sub, {
      match_score: m.match_score,
      match_reason: m.match_reason,
      preview_tags: m.preview_tags,
      identity_summary,
    });
    if (profiles.length >= MAX_MEMBERS) break;
  }

  if (!profiles.length) {
    return json({ ok: false, error: 'no_valid_members' }, { status: 400 });
  }

  const intel = await runBrandAudienceIntel({
    structured,
    keyTraits,
    members: profiles,
    memberExtras,
    maxMembers: MAX_MEMBERS,
  });

  if (!intel) {
    return json({ ok: false, error: 'intel_failed' }, { status: 502 });
  }

  return json({
    ok: true,
    intel,
    members_used: profiles.length,
  });
};
