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
    const tags = flattenIdentityGraph(graph).slice(0, 8);

    const personality = ig?.personality as { expressive: number; humor: number; introspective: number } | undefined;
    const visual = ig?.visual as Record<string, unknown> | undefined;
    const engagement = ig?.engagement as Record<string, unknown> | undefined;

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
      strengthLabel: strength.label,
      initial: ((row.name as string) || '?').charAt(0).toUpperCase(),

      // Identity signals
      aesthetic: (graph.aesthetic as string) || (ig?.aesthetic as string) || '',
      lifestyle: (graph.lifestyle as string) || (ig?.lifestyle as string) || '',
      brandVibes: ((graph.brandVibes || ig?.brandVibes || []) as string[]).slice(0, 5),
      interests: ((graph.interests || ig?.interests || []) as string[]).slice(0, 8),
      activities: ((graph.activities || []) as string[]).slice(0, 5),
      contentCategories: ((graph.contentCategories || []) as string[]).slice(0, 5),

      // Instagram profile
      profilePicture: (ig?.profilePicture as string) || '',
      bio: ((ig?.rawSummary as string) || '').slice(0, 200),
      mediaCount: (ig?.mediaCount as number) || 0,
      engagementTier: (engagement?.engagementTier as string) || '',
      captionIntent: (ig?.captionIntent as string) || '',
      creatorTier: (ig?.igCreatorTier as string) || '',
      personality: personality || null,

      // Visual
      colorPalette: ((visual?.colorPalette || []) as string[]).slice(0, 4),
      aestheticTone: ((visual?.aesthetic as any)?.tone as string) || '',
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
