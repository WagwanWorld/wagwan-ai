import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { buildBrandInviteContext } from '$lib/server/marketplace/brandInviteContext';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const brandId = url.searchParams.get('brand')?.trim() ?? '';
  const inviteId = url.searchParams.get('invite')?.trim() || undefined;
  const fallbackName = url.searchParams.get('from')?.trim() || undefined;

  if (!brandId || !UUID_RE.test(brandId)) {
    throw error(400, 'Valid brand id is required');
  }

  const sb = getServiceSupabase();
  const context = await buildBrandInviteContext(sb, brandId, { inviteId, fallbackName });

  if (!context) {
    throw error(404, 'Brand not found');
  }

  return json({ ok: true, context });
};
