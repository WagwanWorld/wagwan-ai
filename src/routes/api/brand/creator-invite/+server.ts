import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { processCreatorInvite } from '$lib/server/marketplace/creatorInvite';
import { scrapeInstagram } from '$lib/server/marketplace/instagramScrape';

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }

  let body: { instagram?: string; actorGoogleSub?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const brandIgUserId = assertBrandAccess(request, body.actorGoogleSub);
  const instagram = typeof body.instagram === 'string' ? body.instagram.trim() : '';
  if (!instagram) {
    throw error(400, 'instagram is required');
  }

  const sb = getServiceSupabase();

  try {
    const result = await processCreatorInvite(sb, brandIgUserId, instagram, scrapeInstagram);
    return json({
      ok: true,
      entry: result.entry,
      profile: result.profile,
      analysis: result.analysis,
      inviteMessage: result.inviteMessage,
      links: result.links,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'invite_failed';
    if (msg === 'invalid_handle') throw error(400, 'Invalid Instagram handle');
    if (msg === 'profile_not_found')
      throw error(404, 'Could not find that public Instagram profile');
    if (msg === 'public_base_url_not_configured') {
      return json({ ok: false, error: 'public_base_url_not_configured' }, { status: 503 });
    }
    console.error('[creator-invite]', msg);
    throw error(500, 'Could not create invite');
  }
};
