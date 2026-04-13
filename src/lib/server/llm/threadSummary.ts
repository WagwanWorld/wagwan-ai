/**
 * Rolling twin thread compression for /api/chat/summarize.
 * Prefers local Ollama (no API cost) when configured; falls back to Anthropic, then extractive text.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

export const THREAD_SUMMARY_MAX_CHARS = 1200;

export const THREAD_SUMMARY_SYSTEM_PROMPT =
  'Compress the chat into one short memory block (max 1200 characters): themes, open decisions, names/places, and what to remember for follow-ups. No JSON, plain text.';

function clampSummary(text: string): string {
  return text.trim().slice(0, THREAD_SUMMARY_MAX_CHARS);
}

/** Cheap offline summary when no LLM is available. */
export function extractiveThreadSummary(messages: { role: string; text: string }[]): string {
  const userTexts = messages
    .filter(m => m.role === 'user')
    .map(m => String(m.text).replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!userTexts.length) return '';
  if (userTexts.length === 1) {
    return clampSummary(`Offline memory: ${userTexts[0]}`);
  }
  const head = userTexts.slice(0, 2).join(' · ');
  const tailParts = userTexts.slice(-2);
  const tail = tailParts.join(' · ');
  const body =
    tail !== head && tailParts.length
      ? `Offline memory: ${head} … ${tail}`
      : `Offline memory: ${head}`;
  return clampSummary(body);
}

function normalizeOllamaBase(url: string): string {
  return url.replace(/\/+$/, '');
}

async function summarizeWithOllama(
  baseUrl: string,
  model: string,
  transcript: string,
): Promise<string | null> {
  const url = `${normalizeOllamaBase(baseUrl)}/api/chat`;
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), 60_000);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ac.signal,
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: 'system', content: THREAD_SUMMARY_SYSTEM_PROMPT },
          { role: 'user', content: transcript },
        ],
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.error('[threadSummary] Ollama HTTP', res.status, errText.slice(0, 300));
      return null;
    }
    const data = (await res.json()) as { message?: { content?: string } };
    const text = typeof data.message?.content === 'string' ? data.message.content : '';
    if (!text.trim()) return null;
    return clampSummary(text);
  } catch (e) {
    console.error('[threadSummary] Ollama', e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function summarizeWithAnthropic(transcript: string): Promise<string | null> {
  const key = (env.ANTHROPIC_API_KEY ?? '').trim();
  if (!key) return null;
  try {
    const anthropic = new Anthropic({ apiKey: key, timeout: 60_000 });
    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: THREAD_SUMMARY_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: transcript }],
    });
    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    if (!text.trim()) return null;
    return clampSummary(text);
  } catch (e) {
    console.error('[threadSummary] Anthropic', e instanceof Error ? e.message : e);
    return null;
  }
}

export type ThreadSummaryProvider = 'auto' | 'ollama' | 'anthropic';

function getProvider(): ThreadSummaryProvider {
  const raw = (env.THREAD_SUMMARY_PROVIDER ?? 'auto').trim().toLowerCase();
  if (raw === 'ollama' || raw === 'anthropic') return raw;
  return 'auto';
}

/**
 * Produce a compressed thread summary string.
 */
export async function summarizeThread(
  transcript: string,
  messages: { role: string; text: string }[],
): Promise<string> {
  const provider = getProvider();
  const ollamaBase = (env.OLLAMA_BASE_URL ?? '').trim();
  const ollamaModel = (env.OLLAMA_MODEL ?? 'llama3.2').trim() || 'llama3.2';

  const tryAnthropic = () => summarizeWithAnthropic(transcript);
  const tryOllama = () =>
    ollamaBase ? summarizeWithOllama(ollamaBase, ollamaModel, transcript) : Promise.resolve(null);

  if (provider === 'ollama') {
    const o = await tryOllama();
    if (o) return o;
    const a = await tryAnthropic();
    if (a) return a;
    return extractiveThreadSummary(messages);
  }

  if (provider === 'anthropic') {
    const a = await tryAnthropic();
    if (a) return a;
    const o = await tryOllama();
    if (o) return o;
    return extractiveThreadSummary(messages);
  }

  // auto: Ollama first if URL set
  if (ollamaBase) {
    const o = await tryOllama();
    if (o) return o;
  }
  const a = await tryAnthropic();
  if (a) return a;
  return extractiveThreadSummary(messages);
}
