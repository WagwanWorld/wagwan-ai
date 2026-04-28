import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * DEPRECATED: Use /api/brand/creative-studio/direct (step 1)
 * then /api/brand/creative-studio/render (step 2) instead.
 *
 * This endpoint is kept as a redirect for backwards compatibility.
 */
export const POST: RequestHandler = async () => {
  return json({
    ok: false,
    error: 'This endpoint is deprecated. Use /api/brand/creative-studio/direct then /api/brand/creative-studio/render',
  }, { status: 410 });
};
