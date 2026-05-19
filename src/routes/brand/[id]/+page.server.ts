import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { buildBrandInviteContext } from '$lib/server/marketplace/brandInviteContext';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const load: PageServerLoad = async ({ params, url }) => {
  const brandId = params.id?.trim() ?? '';
  if (!brandId || !UUID_RE.test(brandId)) {
    throw error(404, 'Brand not found');
  }

  if (!isSupabaseConfigured()) {
    throw error(503, 'Service unavailable');
  }

  const sb = getServiceSupabase();
  const context = await buildBrandInviteContext(sb, brandId, {
    fallbackName: url.searchParams.get('from')?.trim() || undefined,
  });

  if (!context) {
    throw error(404, 'Brand not found');
  }

  return {
    context,
    returnPath: url.searchParams.get('return')?.trim() || null,
  };
};
