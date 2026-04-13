import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { extractWagwanUserId, isWagwanAuthConfigured } from '$lib/server/wagwanAuth';
import { getProfileByWagwanId, isSupabaseConfigured } from '$lib/server/supabase';
import { parseInferenceIdentityWrapper } from '$lib/server/marketplace/inferenceIdentitySchema';

/**
 * GET /api/wagwan/identity?user_id=<wagwan-uuid>
 *
 * Returns identity graph and inference data for a wagwan user.
 * If user_id is omitted, returns data for the authenticated user.
 *
 * Headers: Authorization: Bearer <wagwan-access-token>
 */
export const GET: RequestHandler = async ({ request, url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }
  if (!isWagwanAuthConfigured()) {
    return json({ ok: false, error: 'wagwan_auth_not_configured' }, { status: 503 });
  }

  const callerUserId = extractWagwanUserId(request);
  if (!callerUserId) {
    return json({ ok: false, error: 'invalid_or_missing_token' }, { status: 401 });
  }

  const targetUserId = url.searchParams.get('user_id')?.trim() || callerUserId;

  const profile = await getProfileByWagwanId(targetUserId);
  if (!profile) {
    return json({ ok: false, error: 'user_not_linked' }, { status: 404 });
  }

  const graph = (profile.identity_graph ?? {}) as Record<string, unknown>;
  const inference = parseInferenceIdentityWrapper(graph.inferenceIdentity);

  return json({
    ok: true,
    wagwan_user_id: targetUserId,
    google_sub: profile.google_sub,
    name: profile.name,
    email: profile.email,
    identity_summary: profile.identity_summary,
    identity_graph: graph,
    inference: inference
      ? {
          revision: inference.revision,
          inferredAt: inference.inferredAt,
          current: inference.current,
        }
      : null,
    updated_at: profile.updated_at,
  });
};
