import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const GET: RequestHandler = async ({ request, url }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const limit = Math.min(Number(url.searchParams.get('limit') || '20'), 50);
  const supabaseUrl = env.SUPABASE_URL!;
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/creative_generations?brand_account_id=eq.${igUserId}&order=created_at.desc&limit=${limit}&select=*,creative_generation_versions(version,image_gcs_url,cost_usd,created_at)`,
    { headers },
  );

  if (!res.ok) throw error(500, 'Failed to fetch history');
  const generations = await res.json();

  return json({ ok: true, generations });
};
