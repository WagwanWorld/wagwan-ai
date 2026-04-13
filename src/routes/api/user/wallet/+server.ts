import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';

export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const sub = url.searchParams.get('sub');
  if (!sub?.trim()) {
    throw error(400, 'sub is required');
  }

  const sb = getServiceSupabase();
  const { data: rows, error: qErr } = await sb
    .from('user_earnings')
    .select('id, campaign_id, amount_inr, status, note, created_at')
    .eq('user_google_sub', sub.trim())
    .order('created_at', { ascending: false })
    .limit(100);

  if (qErr) {
    console.error('[user/wallet]', qErr.message);
    throw error(500, 'Database error');
  }

  const list = rows ?? [];
  let total_inr = 0;
  let pending_inr = 0;
  let available_inr = 0;

  for (const r of list) {
    const amt = Number(r.amount_inr ?? 0);
    total_inr += amt;
    if (r.status === 'pending') pending_inr += amt;
    if (r.status === 'available') available_inr += amt;
  }

  total_inr = Math.round(total_inr * 100) / 100;
  pending_inr = Math.round(pending_inr * 100) / 100;
  available_inr = Math.round(available_inr * 100) / 100;

  return json({
    ok: true,
    summary: {
      total_inr,
      pending_inr,
      withdrawable_inr: available_inr,
    },
    transactions: list.map(r => ({
      id: r.id,
      campaign_id: r.campaign_id,
      amount_inr: r.amount_inr,
      status: r.status,
      note: r.note,
      created_at: r.created_at,
    })),
  });
};
