import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ url }) => {
  const signal = url.searchParams.get('signal');
  const minLift = parseFloat(url.searchParams.get('min_lift') ?? '1.5');

  if (!signal) {
    throw error(400, 'signal param required');
  }

  const supabase = getServiceSupabase();
  const { data } = await supabase
    .from('correlation_index')
    .select('signal_b, signal_b_cat, lift, confidence, support_count, domain_distance')
    .eq('signal_a', signal)
    .eq('is_active', true)
    .gte('lift', minLift)
    .order('lift', { ascending: false })
    .limit(25);

  return json({ signal, correlates: data ?? [], count: data?.length ?? 0 });
};
