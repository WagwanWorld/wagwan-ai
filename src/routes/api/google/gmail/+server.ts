/**
 * GET /api/google/gmail — fresh inbox summary for the home feed.
 * Supports auto-refresh: pass x-google-refresh header for token renewal on 401.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchGmailSummary, refreshGoogleToken } from '$lib/server/google';
import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';

const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 30_000 });

async function tryFetchGmail(token: string) {
  const { threads, senders } = await fetchGmailSummary(token);
  return { threads, senders };
}

export const GET: RequestHandler = async ({ request }) => {
  let token = request.headers.get('x-google-token');
  const refreshToken = request.headers.get('x-google-refresh') || '';
  if (!token) return json({ bullets: [], subjects: [] });

  let threads: string[] = [];
  let senders: string[] = [];
  let newToken: string | undefined;

  try {
    const result = await tryFetchGmail(token);
    threads = result.threads;
    senders = result.senders;
  } catch (e) {
    if (refreshToken) {
      try {
        token = await refreshGoogleToken(refreshToken);
        newToken = token;
        const result = await tryFetchGmail(token);
        threads = result.threads;
        senders = result.senders;
      } catch (e2) {
        console.error('Gmail refresh+retry failed:', e2);
        return json({ bullets: [], subjects: [], error: 'auth_failed' }, { status: 401 });
      }
    } else {
      console.error('Gmail fetch failed (no refresh token):', e);
      return json({ bullets: [], subjects: [], error: 'auth_failed' }, { status: 401 });
    }
  }

  if (!threads.length) return json({ bullets: [], subjects: threads, newToken });

  try {
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `These are emails received in the last 24 hours. Summarise into 3 short bullet points (max 9 words each). Be specific — mention sender names, topics, numbers, deadlines where relevant. Return JSON array only: ["bullet1","bullet2","bullet3"]\n\nSubjects:\n${threads.join('\n')}\n\nSenders: ${senders.join(', ')}`,
      }],
    });

    const text = res.content[0].type === 'text' ? res.content[0].text : '[]';
    const match = text.match(/\[[\s\S]*\]/);
    const bullets: string[] = match ? JSON.parse(match[0]) : [];

    return json({ bullets: bullets.slice(0, 3), subjects: threads.slice(0, 5), newToken });
  } catch (e) {
    console.error('Gmail summary error:', e);
    return json({ bullets: [], subjects: [], newToken }, { status: 500 });
  }
};
