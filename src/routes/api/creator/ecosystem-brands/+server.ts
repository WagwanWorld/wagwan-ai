import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return json({ ok: false, brands: [] });
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/brand_accounts?select=ig_username,ig_name,ig_profile_picture,ig_followers_count,brand_identity&order=ig_followers_count.desc&limit=30`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      },
    );
    if (!res.ok) return json({ ok: false, brands: [] });

    const rows = (await res.json()) as Array<{
      ig_username: string;
      ig_name: string | null;
      ig_profile_picture: string | null;
      ig_followers_count: number | null;
      brand_identity: Record<string, unknown> | null;
    }>;

    const brands = rows.map((r) => ({
      username: r.ig_username,
      name: r.ig_name || r.ig_username,
      picture: r.ig_profile_picture || null,
      followers: r.ig_followers_count || 0,
      category: (r.brand_identity as any)?.category || (r.brand_identity as any)?.industry || '',
    }));

    return json({ ok: true, brands });
  } catch {
    return json({ ok: false, brands: [] });
  }
};
