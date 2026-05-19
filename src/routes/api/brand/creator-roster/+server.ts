import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { resolveBrandForSession } from '$lib/server/marketplace/creatorInvite';
import type { CreatorInviteAnalysis } from '$lib/types/creator-invite';
import { coerceRosterProfileSnapshot } from '$lib/types/creator-invite';

function mapRow(row: Record<string, unknown>) {
  const ig = String(row.ig_username ?? '');
  return {
    id: row.id,
    brand_id: row.brand_id,
    ig_username: ig,
    display_name: row.display_name,
    profile_snapshot: coerceRosterProfileSnapshot(
      (row.profile_snapshot ?? {}) as Record<string, unknown>,
      ig,
      String(row.display_name ?? ''),
    ),
    user_google_sub: row.user_google_sub ?? null,
    invite_message: row.invite_message,
    onboarding_url: row.onboarding_url,
    analysis_snapshot: (row.analysis_snapshot ?? {}) as CreatorInviteAnalysis,
    status: row.status,
    delivery_status: row.delivery_status,
    sent_at: row.sent_at,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const GET: RequestHandler = async ({ request, url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  const actorGoogleSub = url.searchParams.get('actorGoogleSub') ?? undefined;
  const sb = getServiceSupabase();
  const brandIgUserId = assertBrandAccess(request, actorGoogleSub);
  const { brandId } = await resolveBrandForSession(sb, brandIgUserId, 'Brand');

  const delivery = url.searchParams.get('delivery_status')?.trim();
  const status = url.searchParams.get('status')?.trim();
  const q = url.searchParams.get('q')?.trim().toLowerCase();

  let query = sb
    .from('brand_creator_roster')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (delivery === 'draft' || delivery === 'copied' || delivery === 'sent_manual') {
    query = query.eq('delivery_status', delivery);
  }
  if (status === 'prospect' || status === 'on_platform') {
    query = query.eq('status', status);
  }

  const { data: rows, error: qErr } = await query;

  if (qErr) {
    console.error('[creator-roster] list', qErr.message);
    throw error(500, 'Could not load roster');
  }

  let roster = (rows ?? []).map((r) => mapRow(r as Record<string, unknown>));

  if (q) {
    roster = roster.filter(
      (row) =>
        row.ig_username.toLowerCase().includes(q) ||
        String(row.display_name).toLowerCase().includes(q) ||
        row.profile_snapshot.displayName.toLowerCase().includes(q),
    );
  }

  return json({ ok: true, roster, count: roster.length });
};

export const PATCH: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: { id?: string; delivery_status?: string; actorGoogleSub?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  const delivery_status = body.delivery_status;
  if (!id || (delivery_status !== 'copied' && delivery_status !== 'sent_manual')) {
    throw error(400, 'id and valid delivery_status required');
  }

  const sb = getServiceSupabase();
  const brandIgUserId = assertBrandAccess(request, body.actorGoogleSub);
  const { brandId } = await resolveBrandForSession(sb, brandIgUserId, 'Brand');

  const patch: Record<string, unknown> = {
    delivery_status,
    updated_at: new Date().toISOString(),
  };
  if (delivery_status === 'sent_manual') {
    patch.sent_at = new Date().toISOString();
  }

  const { data: updated, error: uErr } = await sb
    .from('brand_creator_roster')
    .update(patch)
    .eq('id', id)
    .eq('brand_id', brandId)
    .select('*')
    .maybeSingle();

  if (uErr || !updated) {
    throw error(404, 'Roster entry not found');
  }

  return json({ ok: true, entry: mapRow(updated as Record<string, unknown>) });
};

export const DELETE: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: { id?: string; actorGoogleSub?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const id = typeof body.id === 'string' ? body.id.trim() : '';
  if (!id) throw error(400, 'id required');

  const sb = getServiceSupabase();
  const brandIgUserId = assertBrandAccess(request, body.actorGoogleSub);
  const { brandId } = await resolveBrandForSession(sb, brandIgUserId, 'Brand');

  const { error: dErr } = await sb
    .from('brand_creator_roster')
    .delete()
    .eq('id', id)
    .eq('brand_id', brandId);

  if (dErr) {
    console.error('[creator-roster] delete', dErr.message);
    throw error(500, 'Could not remove roster entry');
  }

  return json({ ok: true });
};
