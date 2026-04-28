import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { env } from '$env/dynamic/private';
import { uploadCreativeToGCS } from '$lib/server/marketplace/gcsUpload';

export const GET: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const supabaseUrl = env.SUPABASE_URL!;
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_assets?brand_account_id=eq.${igUserId}&order=created_at.desc`,
    { headers },
  );
  if (!res.ok) throw error(500, 'Failed to fetch assets');
  const assets = await res.json();

  return json({ ok: true, assets });
};

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const formData = await request.formData();
  const file = formData.get('file') as File;
  const type = formData.get('type') as string || 'logo_primary';
  const variant = formData.get('variant') as string || null;
  const isDefault = formData.get('isDefault') === 'true';

  if (!file) throw error(400, 'No file provided');

  // Determine format from file type
  const formatMap: Record<string, string> = {
    'image/svg+xml': 'svg',
    'image/png': 'png',
    'font/woff2': 'woff2',
    'font/ttf': 'ttf',
    'font/otf': 'otf',
    'application/font-woff2': 'woff2',
    'application/x-font-ttf': 'ttf',
  };
  const format = formatMap[file.type] || 'png';

  // Upload to GCS
  const uploadResult = await uploadCreativeToGCS(file, igUserId);

  const supabaseUrl = env.SUPABASE_URL!;
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json' };

  // If this is default, unset other defaults of same type
  if (isDefault) {
    await fetch(
      `${supabaseUrl}/rest/v1/brand_assets?brand_account_id=eq.${igUserId}&type=eq.${type}&is_default=eq.true`,
      { method: 'PATCH', headers, body: JSON.stringify({ is_default: false }) },
    );
  }

  const res = await fetch(`${supabaseUrl}/rest/v1/brand_assets`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'return=representation' },
    body: JSON.stringify({
      brand_account_id: igUserId,
      type,
      variant,
      format,
      url: uploadResult.url,
      is_default: isDefault,
      metadata: { originalName: file.name, size: file.size, license_attested: false },
    }),
  });

  if (!res.ok) throw error(500, 'Failed to save asset');
  const [asset] = await res.json();

  return json({ ok: true, asset });
};

export const DELETE: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const body = await request.json();
  const { assetId } = body as { assetId: string };
  if (!assetId) throw error(400, 'assetId required');

  const supabaseUrl = env.SUPABASE_URL!;
  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY!, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };

  const res = await fetch(
    `${supabaseUrl}/rest/v1/brand_assets?id=eq.${assetId}&brand_account_id=eq.${igUserId}`,
    { method: 'DELETE', headers },
  );
  if (!res.ok) throw error(500, 'Failed to delete asset');

  return json({ ok: true });
};
