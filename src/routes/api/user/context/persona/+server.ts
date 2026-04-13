import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isSupabaseConfigured } from '$lib/server/supabase';
import { buildContext } from '$lib/server/identityContext/buildContext';

/** GET /api/user/context/persona?sub= — compressed persona-flavored pack (identity intent). */
export const GET: RequestHandler = async ({ url }) => {
  if (!isSupabaseConfigured()) {
    return json({ ok: false, error: 'supabase_not_configured' }, { status: 503 });
  }
  const sub = url.searchParams.get('sub')?.trim() ?? '';
  if (!sub) return json({ ok: false, error: 'missing_sub' }, { status: 400 });

  const context = await buildContext(sub, 'who am I');
  if (!context) return json({ ok: false, error: 'profile_not_found' }, { status: 404 });

  return json({
    ok: true,
    intent: context.intent,
    context: {
      ...context,
      persona: context.persona,
      claims_relevant: context.claims_relevant,
    },
  });
};
