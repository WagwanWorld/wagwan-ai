import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { summarizeThread } from '$lib/server/llm/threadSummary';

export const POST: RequestHandler = async ({ request }) => {
  let body: { messages?: { role: string; text: string }[] };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }
  const msgs = body.messages ?? [];
  if (!msgs.length) return json({ summary: '' });

  const transcript = msgs
    .slice(-30)
    .map(m => `${m.role === 'user' ? 'User' : 'Twin'}: ${String(m.text).slice(0, 2000)}`)
    .join('\n')
    .slice(0, 12000);

  try {
    const summary = await summarizeThread(transcript, msgs);
    return json({ summary });
  } catch (e) {
    console.error('summarize thread:', e);
    throw error(500, 'Summary failed');
  }
};
