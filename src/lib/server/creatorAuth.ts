import type { SupabaseClient } from '@supabase/supabase-js';
import { extractWagwanUserId } from '$lib/server/wagwanAuth';

export async function resolveCreatorGoogleSubFromRequest(
  sb: SupabaseClient,
  request: Request,
): Promise<string | null> {
  const wagwanUserId = extractWagwanUserId(request);
  if (!wagwanUserId) return null;

  const { data, error } = await sb
    .from('user_profiles')
    .select('google_sub')
    .eq('wagwan_user_id', wagwanUserId)
    .maybeSingle();

  if (error) {
    console.error('[creatorAuth] linked profile lookup failed:', error.message);
    return null;
  }

  const googleSub = String(data?.google_sub ?? '').trim();
  return googleSub || null;
}
