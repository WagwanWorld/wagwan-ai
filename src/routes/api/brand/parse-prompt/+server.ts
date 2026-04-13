import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseAudiencePrompt } from '$lib/server/marketplace/parseAudiencePrompt';

export const POST: RequestHandler = async ({ request }) => {
  let body: { prompt?: string; actorGoogleSub?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt : '';
  if (!prompt.trim()) {
    throw error(400, 'prompt is required');
  }

  try {
    const structured = await parseAudiencePrompt(prompt);
    return json({ ok: true, structured });
  } catch (e) {
    console.error('[brand/parse-prompt]', e);
    throw error(500, 'Parse failed');
  }
};
