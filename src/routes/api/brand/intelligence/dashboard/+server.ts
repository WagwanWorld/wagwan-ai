/**
 * GET /api/brand/intelligence/dashboard
 * Single endpoint that returns ALL dashboard data in one call.
 * Queries only Supabase (no Instagram API, no Claude) — pure reads, fast.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;
  const headers = { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` };

  try {
    // Fetch everything in parallel — all from Supabase, all fast
    const [snapRes, briefRes, propRes, compRes] = await Promise.all([
      fetch(
        `${supabaseUrl}/rest/v1/brand_snapshots?brand_ig_id=eq.${encodeURIComponent(igUserId)}&order=snapshot_date.desc&limit=1`,
        { headers },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/brand_weekly_briefs?brand_ig_id=eq.${encodeURIComponent(igUserId)}&order=brief_date.desc&limit=1`,
        { headers },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/brand_action_proposals?brand_ig_id=eq.${encodeURIComponent(igUserId)}&status=eq.pending&order=created_at.desc&limit=10`,
        { headers },
      ),
      fetch(
        `${supabaseUrl}/rest/v1/brand_competitors?brand_ig_id=eq.${encodeURIComponent(igUserId)}&order=created_at.desc`,
        { headers },
      ),
    ]);

    const snapshots = snapRes.ok ? await snapRes.json() : [];
    const briefs = briefRes.ok ? await briefRes.json() : [];
    const proposals = propRes.ok ? await propRes.json() : [];
    const competitors = compRes.ok ? await compRes.json() : [];

    return json({
      ok: true,
      snapshot: snapshots[0] || null,
      brief: briefs[0] || null,
      proposals,
      competitors,
    });
  } catch (e) {
    console.error('[Dashboard] Failed to load:', e);
    return json({ ok: false, snapshot: null, brief: null, proposals: [], competitors: [] });
  }
};
