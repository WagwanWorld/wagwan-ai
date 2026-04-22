// src/routes/api/brand/intelligence/proposals/[id]/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';

export const PATCH: RequestHandler = async ({ request, params }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const body = await request.json();
  const status = body.status;
  if (!['approved', 'rejected'].includes(status)) {
    throw error(400, 'Status must be "approved" or "rejected"');
  }

  const supabaseUrl = env.SUPABASE_URL!;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_action_proposals?id=eq.${params.id}&brand_ig_id=eq.${encodeURIComponent(igUserId)}`,
    {
      method: 'PATCH',
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status, acted_at: new Date().toISOString() }),
    },
  );

  if (!res.ok) throw error(500, 'Failed to update proposal');
  return json({ ok: true, status });
};
