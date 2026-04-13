/**
 * Returns a fresh Apple Music developer token to the client.
 * The frontend uses this to configure MusicKit JS.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { generateDeveloperToken, isAppleMusicConfigured } from '$lib/server/applemusic';

export const GET: RequestHandler = async () => {
  if (!isAppleMusicConfigured()) {
    throw error(503, 'Apple Music not configured');
  }
  try {
    const token = generateDeveloperToken();
    return json({ token });
  } catch (e) {
    console.error('Developer token generation failed:', e);
    throw error(500, 'Failed to generate developer token');
  }
};
