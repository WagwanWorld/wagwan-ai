import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProfile } from '$lib/server/supabase';
import { getVisibility, getRates } from '$lib/server/creatorMarketplace';

export const GET: RequestHandler = async ({ url }) => {
  const sub = url.searchParams.get('sub')?.trim();
  if (!sub) return json({ ok: false, error: 'missing_sub' }, { status: 400 });

  const [profileRow, visibility, rates] = await Promise.all([
    getProfile(sub),
    getVisibility(sub),
    getRates(sub),
  ]);

  if (!profileRow) return json({ ok: false, error: 'profile_not_found' }, { status: 404 });

  const profileData = (profileRow.profile_data ?? {}) as Record<string, unknown>;
  const graph = (profileRow.identity_graph ?? {}) as Record<string, unknown>;
  const vis = visibility ?? { music_visible: true, instagram_visible: true, career_visible: true, lifestyle_visible: true, calendar_visible: false, email_visible: false };

  // Build visible sections list
  const visibleSections: string[] = [];
  if (vis.music_visible) visibleSections.push('Music');
  if (vis.instagram_visible) visibleSections.push('Instagram');
  if (vis.career_visible) visibleSections.push('Career');
  if (vis.lifestyle_visible) visibleSections.push('Lifestyle');
  if (vis.calendar_visible) visibleSections.push('Calendar');
  if (vis.email_visible) visibleSections.push('Email');

  // Extract public-safe data
  const ig = profileData.instagramIdentity as Record<string, unknown> | undefined;

  const portrait = {
    name: profileRow.name || '',
    city: (profileData.city as string) || '',
    archetype: (graph as any)?.identitySnapshot?.payload?.archetype || '',
    vibeTags: (graph as any)?.identitySnapshot?.payload?.vibe?.slice(0, 4) || [],
    integrityScore: 0, // Will be computed from graph strength
    followers: vis.instagram_visible && ig ? (ig.followersCount ?? 0) : 0,
    posts: vis.instagram_visible && ig ? (ig.mediaCount ?? 0) : 0,
    rates: rates ?? null,
    visibleSections,
    summary: profileRow.identity_summary || '',
  };

  return json({ ok: true, portrait });
};
