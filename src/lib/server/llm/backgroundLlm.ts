/**
 * LLM completion for background tasks (non-streaming, JSON output).
 *
 * Tries Anthropic first (claude-haiku-4-5), falls back to Ollama if:
 * - ANTHROPIC_API_KEY is missing, OR
 * - Anthropic call fails AND BACKGROUND_OLLAMA_FALLBACK=true
 *
 * All background tasks (morning brief, home feed, identity inference,
 * platform analysis) should use this instead of direct Anthropic calls.
 */

import Anthropic from '@anthropic-ai/sdk';
import { env } from '$env/dynamic/private';

const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

function getModel(): string {
  return (env.BACKGROUND_LLM_MODEL ?? '').trim() || DEFAULT_MODEL;
}

function getOllamaBaseUrl(): string {
  return (env.OLLAMA_BASE_URL ?? 'http://127.0.0.1:11434').replace(/\/+$/, '');
}

function getOllamaModel(): string {
  return (env.OLLAMA_MODEL ?? 'llama3.2').trim();
}

function isOllamaFallbackEnabled(): boolean {
  const v = (env.BACKGROUND_OLLAMA_FALLBACK ?? env.CHAT_OLLAMA_FALLBACK ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

function isAnthropicConfigured(): boolean {
  return !!(env.ANTHROPIC_API_KEY?.trim());
}

/**
 * Run a completion via Anthropic. Returns the text response.
 */
async function anthropicComplete(
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const key = env.ANTHROPIC_API_KEY?.trim();
  if (!key) throw new Error('[backgroundLlm] ANTHROPIC_API_KEY not set');

  const client = new Anthropic({ apiKey: key, timeout: 60_000 });
  const msg = await client.messages.create({
    model: getModel(),
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  });

  const block = msg.content[0];
  return block.type === 'text' ? block.text : '';
}

/**
 * Run a completion via Ollama. Returns the text response.
 */
async function ollamaComplete(
  system: string,
  user: string,
): Promise<string> {
  const base = getOllamaBaseUrl();
  const model = getOllamaModel();

  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: false,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`[backgroundLlm] Ollama HTTP ${res.status}: ${err.slice(0, 300)}`);
  }

  const data = (await res.json()) as { message?: { content?: string } };
  return data.message?.content ?? '';
}

/**
 * Run a background LLM completion with Ollama fallback.
 *
 * @param system - System prompt
 * @param user - User prompt
 * @param maxTokens - Max tokens for Anthropic (ignored for Ollama)
 * @returns The text response
 */
export async function backgroundComplete(
  system: string,
  user: string,
  maxTokens = 1500,
): Promise<string> {
  // If Anthropic is configured, try it first
  if (isAnthropicConfigured()) {
    try {
      return await anthropicComplete(system, user, maxTokens);
    } catch (e) {
      console.error('[backgroundLlm] Anthropic failed:', e instanceof Error ? e.message : e);
      if (!isOllamaFallbackEnabled()) throw e;
      console.log('[backgroundLlm] Falling back to Ollama...');
    }
  }

  // Ollama fallback (or primary if no Anthropic key)
  if (isOllamaFallbackEnabled() || !isAnthropicConfigured()) {
    return await ollamaComplete(system, user);
  }

  throw new Error('[backgroundLlm] No LLM provider available. Set ANTHROPIC_API_KEY or enable BACKGROUND_OLLAMA_FALLBACK=true');
}

/**
 * Convenience: run a background completion and parse JSON from the response.
 * Extracts the first JSON object found in the text.
 */
export async function backgroundCompleteJson<T>(
  system: string,
  user: string,
  maxTokens = 1500,
): Promise<T | null> {
  const text = await backgroundComplete(system, user, maxTokens);
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]) as T;
    // Try array
    const arrMatch = text.match(/\[[\s\S]*\]/);
    if (arrMatch) return JSON.parse(arrMatch[0]) as T;
  } catch {
    console.error('[backgroundLlm] Failed to parse JSON from response');
  }
  return null;
}
