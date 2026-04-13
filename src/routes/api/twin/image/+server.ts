/**
 * POST /api/twin/image — build a style-aware image URL (Pollinations, no API key).
 * For sharing/saving only; no auto-post to Instagram.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  let body: { prompt?: string; profile?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }
  const userPrompt = String(body.prompt ?? '').trim().slice(0, 800);
  if (!userPrompt) throw error(400, 'prompt required');

  const ig = body.profile?.instagramIdentity as { aesthetic?: string; brandVibes?: string[] } | undefined;
  const styleBits = [ig?.aesthetic, ...(ig?.brandVibes ?? []).slice(0, 4)].filter(Boolean).join(', ');
  const full = [styleBits && `Visual style: ${styleBits}.`, userPrompt].filter(Boolean).join(' ').slice(0, 1200);

  const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(full)}?width=768&height=768&nologo=true`;

  return json({ imageUrl, note: 'Generated via Pollinations; review before sharing.' });
};
