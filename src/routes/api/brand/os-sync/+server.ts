import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import {
  fetchFollowerSnapshot,
  fetchAccountReach,
  fetchDemographicBreakdowns,
  fetchOnlineFollowers,
  fetchPostFollowAttribution,
  saveFollowerSnapshot,
  saveDemographicSnapshot,
  saveOnlineActivitySnapshot,
  savePostAttribution,
} from '$lib/server/brand/followerAnalytics';
type SyncAction = 'refresh_dashboard' | 'regenerate_synopsis' | 'regenerate_brand_kit';

async function callInternal(
  request: Request,
  path: string,
  method: 'GET' | 'POST' = 'POST',
  body?: Record<string, unknown>,
): Promise<void> {
  const origin = new URL(request.url).origin;
  const headers: Record<string, string> = {
    cookie: request.headers.get('cookie') || '',
    authorization: request.headers.get('authorization') || '',
  };
  if (body) headers['content-type'] = 'application/json';
  const res = await fetch(`${origin}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`sync call ${path} failed: ${text || res.status}`);
  }
}

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const body = await request.json().catch(() => ({}));
  const action = String(body?.action || '') as SyncAction;

  try {
    if (action === 'refresh_dashboard') {
      // Phase 1: Ingest latest IG data
      await callInternal(request, '/api/brand/os-ingest');

      // Phase 2: Run LLM analysis (audience + strategy + brief) — phased, updates snapshot progressively
      try {
        await callInternal(request, '/api/brand/os-analyse', 'POST', { phase: 'all' });
      } catch (e) {
        console.error('[brand/os-sync] analysis pipeline error (continuing):', e);
      }

      // Phase 3: Run deterministic pipelines
      await callInternal(request, '/api/brand/os-comments');
      await callInternal(request, '/api/brand/os-insights');

      // Phase 4: Collect follower analytics data (non-blocking)
      try {
        const sb = getServiceSupabase();
        const { data: brand } = await sb
          .from('brand_accounts')
          .select('ig_access_token,ig_followers_count')
          .eq('ig_user_id', igUserId)
          .maybeSingle();
        const token = brand?.ig_access_token as string;
        if (token) {
          // Follower snapshot
          const profile = await fetchFollowerSnapshot(igUserId, token);
          const reach28d = await fetchAccountReach(igUserId, token, 28);
          await saveFollowerSnapshot(igUserId, { ...profile, reach28d });

          // Demographics (only if 100+ followers)
          if (profile.followers >= 100) {
            try {
              const demos = await fetchDemographicBreakdowns(igUserId, token);
              const monday = new Date();
              monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
              await saveDemographicSnapshot(igUserId, monday.toISOString().slice(0, 10), demos);
            } catch (e) {
              console.error('[os-sync] demographics:', e);
            }

            // Online activity heatmap
            try {
              const rawActivity = await fetchOnlineFollowers(igUserId, token);
              const monday = new Date();
              monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
              // Convert OnlineFollowersEntry[] to flat grid cells
              const grid: Array<{ day: number; hour: number; value: number }> = [];
              rawActivity.forEach((entry, dayIdx) => {
                entry.hours.forEach((val, hour) => {
                  grid.push({ day: dayIdx, hour, value: val });
                });
              });
              await saveOnlineActivitySnapshot(igUserId, monday.toISOString().slice(0, 10), grid);
            } catch (e) {
              console.error('[os-sync] online activity:', e);
            }
          }

          // Post attribution (last 25 posts)
          try {
            const mediaRes = await fetch(
              `https://graph.instagram.com/v25.0/${igUserId}/media?fields=id&limit=25&access_token=${token}`,
            );
            if (mediaRes.ok) {
              const mediaJson = await mediaRes.json();
              const postIds = (mediaJson?.data ?? []).map((p: { id: string }) => p.id);
              if (postIds.length > 0) {
                const attributions = await fetchPostFollowAttribution(igUserId, token, postIds);
                await savePostAttribution(igUserId, attributions);
              }
            }
          } catch (e) {
            console.error('[os-sync] post attribution:', e);
          }
        }
      } catch (e) {
        console.error('[os-sync] follower analytics (non-fatal):', e);
      }

      return json({ ok: true, action, message: 'Dashboard refreshed' });
    }

    if (action === 'regenerate_synopsis') {
      await callInternal(request, '/api/brand/os-insights');
      await callInternal(request, '/api/brand/os-brief');
      return json({ ok: true, action, message: 'Synopsis regenerated' });
    }

    if (action === 'regenerate_brand_kit') {
      await callInternal(request, '/api/brand/os-ingest');
      await callInternal(request, '/api/brand/os-comments');
      await callInternal(request, '/api/brand/os-insights');
      await callInternal(request, '/api/brand/os-brief');
      return json({ ok: true, action, message: 'Brand kit regenerated' });
    }

    return json({ ok: false, error: 'invalid_action' }, { status: 400 });
  } catch (err) {
    console.error('[brand/os-sync]', err);
    return json(
      { ok: false, error: err instanceof Error ? err.message : 'sync_failed' },
      { status: 500 },
    );
  }
};
