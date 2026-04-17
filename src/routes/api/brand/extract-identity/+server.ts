/**
 * POST /api/brand/extract-identity
 * Runs the full Instagram identity pipeline on the brand's account:
 * visual identity, caption signals, temporal patterns, engagement, comment graph.
 * Stores result in brand_accounts.brand_identity.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import {
  fetchInstagramProfile,
  fetchInstagramMedia,
  analyseInstagramIdentity,
} from '$lib/server/instagram';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const supabaseUrl = env.SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) throw error(500, 'Not configured');

  // Get brand token
  const brandRes = await fetch(
    `${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(igUserId)}&select=ig_access_token&limit=1`,
    { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } },
  );
  const brands = await brandRes.json();
  if (!brands.length) throw error(404, 'Brand not found');
  const token = brands[0].ig_access_token;

  try {
    // Fetch profile and media using existing functions
    const profile = await fetchInstagramProfile(token);
    const media = await fetchInstagramMedia(token, 20);

    // Run the full identity pipeline (same as user onboarding)
    const identity = await analyseInstagramIdentity(profile, media, token);

    // Store in brand_accounts
    await fetch(`${supabaseUrl}/rest/v1/brand_accounts?ig_user_id=eq.${encodeURIComponent(igUserId)}`, {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        brand_identity: identity,
        identity_updated_at: new Date().toISOString(),
        ig_followers_count: profile.followers_count || 0,
      }),
    });

    return json({ ok: true, identity });
  } catch (e) {
    console.error('[Brand Identity Extraction]', e);
    return json({ ok: false, error: e instanceof Error ? e.message : 'Extraction failed' }, { status: 500 });
  }
};
