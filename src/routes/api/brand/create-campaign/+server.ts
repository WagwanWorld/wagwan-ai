import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import type { CampaignChannels, CampaignTargetInput, ParsedAudience } from '$lib/server/marketplace/types';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: {
    actorGoogleSub?: string;
    brand_name?: string;
    title?: string;
    creative_text?: string;
    channels?: CampaignChannels;
    reward_inr?: number;
    structured_query?: ParsedAudience;
    targets?: CampaignTargetInput[];
  };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  assertBrandAccess(request, body.actorGoogleSub);

  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) {
    throw error(400, 'title is required');
  }

  const brand_name = (typeof body.brand_name === 'string' && body.brand_name.trim()
    ? body.brand_name.trim()
    : 'Brand');

  const creative_text = typeof body.creative_text === 'string' ? body.creative_text : '';
  const reward_inr =
    body.reward_inr != null && Number.isFinite(Number(body.reward_inr))
      ? Number(body.reward_inr)
      : 0;

  const channels: CampaignChannels = {
    email: Boolean(body.channels?.email),
    in_app: body.channels?.in_app !== false,
    whatsapp: Boolean(body.channels?.whatsapp),
  };

  const structured_query = (body.structured_query ?? {}) as ParsedAudience;
  const targets = Array.isArray(body.targets) ? body.targets : [];
  if (!targets.length) {
    throw error(400, 'targets must include at least one user');
  }

  const sb = getServiceSupabase();

  const { data: existingBrand } = await sb.from('brands').select('id').eq('name', brand_name).maybeSingle();

  let brand_id: string;
  if (existingBrand?.id) {
    brand_id = existingBrand.id as string;
  } else {
    const { data: brandRow, error: brandErr } = await sb
      .from('brands')
      .insert({ name: brand_name })
      .select('id')
      .single();

    if (brandErr || !brandRow) {
      console.error('[create-campaign] brand insert', brandErr?.message);
      throw error(500, 'Could not create brand');
    }
    brand_id = brandRow.id as string;
  }

  const { data: camp, error: campErr } = await sb
    .from('campaigns')
    .insert({
      brand_id,
      brand_name,
      title,
      creative_text,
      channels,
      reward_inr,
      structured_query: structured_query as unknown as Record<string, unknown>,
      status: 'active',
    })
    .select('id')
    .single();

  if (campErr || !camp) {
    console.error('[create-campaign] campaign insert', campErr?.message);
    throw error(500, 'Could not create campaign');
  }

  const campaign_id = camp.id as string;

  const audienceRows = targets.map(t => ({
    campaign_id,
    user_google_sub: t.user_google_sub,
    match_score: t.match_score ?? 0,
    match_reason: (t.match_reason ?? '').slice(0, 500),
  }));

  const { error: audErr } = await sb.from('campaign_audience').insert(audienceRows);

  if (audErr) {
    console.error('[create-campaign] audience insert', audErr.message);
    throw error(500, 'Could not attach audience');
  }

  return json({
    ok: true,
    campaign_id,
    brand_id,
    audience_count: audienceRows.length,
  });
};
