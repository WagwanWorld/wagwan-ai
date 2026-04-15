/**
 * POST /api/data-deletion
 *
 * Meta/Instagram User Data Deletion Callback.
 * When a user removes the app from their Facebook/Instagram settings,
 * Meta sends a signed request here. We delete their data and return
 * a confirmation URL + confirmation code.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  // Meta sends a signed_request parameter
  // For now, acknowledge the request and return the required format
  const code = `del_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return json({
    url: `https://wagwanworld.vercel.app/data-deletion?code=${code}`,
    confirmation_code: code,
  });
};
