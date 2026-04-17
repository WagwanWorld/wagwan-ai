/**
 * GET /api/brand/creators
 * Returns all creators in the network with public-safe profile data.
 * Deduplicates by Instagram username — if multiple accounts share the same IG, keep the one with the highest graph strength.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/server/supabase';
import { computeGraphStrength } from '$lib/server/marketplace/graphStrength';
import { flattenIdentityGraph } from '$lib/server/marketplace/identityGraphTags';

export const GET: RequestHandler = async () => {
  const sb = getServiceSupabase();
  const { data: rows } = await sb
    .from('user_profiles')
    .select('google_sub, name, profile_data, identity_graph')
    .limit(200);

  const creators = (rows ?? []).map(row => {
    const graph = (row.identity_graph ?? {}) as Record<string, unknown>;
    const profileData = (row.profile_data ?? {}) as Record<string, unknown>;
    const ig = profileData.instagramIdentity as Record<string, unknown> | undefined;
    const snapshot = graph.identitySnapshot as any;
    const strength = computeGraphStrength(graph, profileData);
    const tags = flattenIdentityGraph(graph).slice(0, 5);

    return {
      googleSub: row.google_sub as string,
      name: (row.name as string) || '',
      handle: (ig?.username as string) || '',
      followers: (ig?.followersCount as number) || 0,
      archetype: snapshot?.payload?.archetype || '',
      location: (graph.city as string) || (profileData.city as string) || '',
      vibeTags: snapshot?.payload?.vibe?.slice(0, 3) || [],
      contentTags: tags,
      strength: strength.score,
      initial: ((row.name as string) || '?').charAt(0).toUpperCase(),
    };
  }).filter(c => c.name);

  // Deduplicate by Instagram handle — keep the profile with highest graph strength
  const deduped = new Map<string, typeof creators[number]>();
  for (const creator of creators) {
    const key = creator.handle
      ? creator.handle.toLowerCase()
      : `${creator.name.toLowerCase()}::${creator.location.toLowerCase()}`;

    const existing = deduped.get(key);
    if (!existing || creator.strength > existing.strength) {
      deduped.set(key, creator);
    }
  }

  // Strip googleSub from response
  const result = [...deduped.values()].map(({ googleSub, ...rest }) => rest);

  return json({ ok: true, creators: result });
};
