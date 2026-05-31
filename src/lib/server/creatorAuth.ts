import { error } from '@sveltejs/kit';
import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId, isWagwanAuthConfigured } from './wagwanAuth';

type CreatorProfileRef = {
  google_sub: string;
};

/**
 * Creator-facing APIs use the service-role Supabase client, so they must bind
 * every requested profile key to the authenticated Wagwan account first.
 */
export async function requireCreatorProfileSub(
  request: Request,
  sb: SupabaseClient,
  requestedGoogleSub?: string | null,
): Promise<string> {
  if (!isWagwanAuthConfigured()) {
    throw error(503, 'Creator authentication is not configured');
  }

  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) {
    throw error(401, 'Creator authentication required');
  }

  let query = sb
    .from('user_profiles')
    .select('google_sub')
    .eq('wagwan_user_id', wagwanUserId)
    .limit(1);

  const requested = requestedGoogleSub?.trim();
  if (requested) {
    query = query.eq('google_sub', requested);
  }

  const { data, error: dbError } = await query.maybeSingle<CreatorProfileRef>();
  if (dbError) {
    console.error('[CreatorAuth] profile lookup failed:', dbError.message);
    throw error(500, 'Creator profile lookup failed');
  }
  if (!data?.google_sub) {
    throw error(403, 'Creator profile access denied');
  }

  return data.google_sub;
}
