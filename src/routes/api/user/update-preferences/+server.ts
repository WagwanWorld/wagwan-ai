import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';

const defaultChannels = { email: true, in_app: true, whatsapp: false };

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: {
    googleSub?: string;
    channels?: { email?: boolean; in_app?: boolean; whatsapp?: boolean };
    categories?: Record<string, boolean>;
    max_campaigns_per_week?: number;
    manualInterestTags?: string[];
  };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const sub = typeof body.googleSub === 'string' ? body.googleSub.trim() : '';
  if (!sub) {
    throw error(400, 'googleSub is required');
  }

  const sb = getServiceSupabase();
  const { data: existing } = await sb
    .from('user_marketing_prefs')
    .select('*')
    .eq('user_google_sub', sub)
    .maybeSingle();

  const base = existing ?? {
    user_google_sub: sub,
    channels: defaultChannels,
    categories: {} as Record<string, boolean>,
    max_campaigns_per_week: 5,
    manual_interest_tags: [] as string[],
  };

  const channels = {
    ...(typeof base.channels === 'object' && base.channels ? (base.channels as object) : defaultChannels),
    ...(body.channels ?? {}),
  };

  const categories = {
    ...(typeof base.categories === 'object' && base.categories ? (base.categories as Record<string, boolean>) : {}),
    ...(body.categories ?? {}),
  };

  let max_campaigns_per_week = Number(base.max_campaigns_per_week) || 5;
  if (body.max_campaigns_per_week != null && Number.isFinite(Number(body.max_campaigns_per_week))) {
    max_campaigns_per_week = Math.max(0, Math.min(50, Math.round(Number(body.max_campaigns_per_week))));
  }

  let manual_interest_tags = Array.isArray(base.manual_interest_tags)
    ? [...(base.manual_interest_tags as string[])]
    : [];
  if (Array.isArray(body.manualInterestTags)) {
    manual_interest_tags = body.manualInterestTags.map(s => String(s).trim()).filter(Boolean).slice(0, 40);
  }

  const row = {
    user_google_sub: sub,
    channels,
    categories,
    max_campaigns_per_week,
    manual_interest_tags,
    updated_at: new Date().toISOString(),
  };

  const { error: upErr } = await sb.from('user_marketing_prefs').upsert(row, { onConflict: 'user_google_sub' });

  if (upErr) {
    console.error('[user/update-preferences]', upErr.message);
    throw error(500, 'Save failed');
  }

  return json({ ok: true, prefs: row });
};
