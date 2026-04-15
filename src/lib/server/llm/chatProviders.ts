/**
 * Pluggable chat completion streaming for /api/chat (streamChatResponse).
 * Anthropic default; optional Ollama or OpenAI-compatible servers.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { env } from '$env/dynamic/private';

export type ChatLlmProvider = 'anthropic' | 'ollama' | 'openai_compatible';

const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

export function getChatLlmProvider(): ChatLlmProvider {
  const p = (env.CHAT_LLM_PROVIDER ?? 'anthropic').trim().toLowerCase();
  if (p === 'ollama' || p === 'openai_compatible') return p;
  return 'anthropic';
}

export function getAnthropicChatModel(): string {
  const m = (env.CHAT_ANTHROPIC_MODEL ?? '').trim();
  return m || DEFAULT_ANTHROPIC_MODEL;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, '');
}

function getOllamaBaseUrl(): string {
  const u = (env.CHAT_OLLAMA_BASE_URL ?? env.OLLAMA_BASE_URL ?? '').trim();
  return u || 'http://127.0.0.1:11434';
}

/** Default small instruct model (~1.3GB); override with CHAT_OLLAMA_MODEL for larger quality. */
const DEFAULT_OLLAMA_CHAT_MODEL = 'llama3.2:1b';

function getOllamaChatModel(): string {
  const m = (env.CHAT_OLLAMA_MODEL ?? env.OLLAMA_MODEL ?? DEFAULT_OLLAMA_CHAT_MODEL).trim();
  return m || DEFAULT_OLLAMA_CHAT_MODEL;
}

/** When true, failed Anthropic chat completions retry once via local Ollama (same prompt). */
export function isOllamaFallbackEnabled(): boolean {
  const v = (env.CHAT_OLLAMA_FALLBACK ?? '').trim().toLowerCase();
  if (v === '1' || v === 'true' || v === 'yes') return true;
  if (v === '0' || v === 'false' || v === 'no') return false;
  return false;
}

async function* streamAnthropicText(params: {
  system: string;
  user: string;
}): AsyncGenerator<string> {
  const key = (ANTHROPIC_API_KEY ?? '').trim();
  if (!key) {
    throw new Error(
      '[chat] ANTHROPIC_API_KEY is missing — set it in .env and restart the dev server.',
    );
  }
  const anthropic = new Anthropic({ apiKey: key, timeout: 90_000 });
  const stream = anthropic.messages.stream({
    model: getAnthropicChatModel(),
    max_tokens: 3000,
    system: params.system,
    messages: [{ role: 'user', content: params.user }],
  });
  for await (const ev of stream) {
    if (ev.type !== 'content_block_delta') continue;
    if (ev.delta.type !== 'text_delta') continue;
    yield ev.delta.text;
  }
}

async function* streamOllamaText(params: { system: string; user: string }): AsyncGenerator<string> {
  const base = normalizeBaseUrl(getOllamaBaseUrl());
  const model = getOllamaChatModel();
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[chat] Ollama HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('[chat] Ollama: empty response body');
  const decoder = new TextDecoder();
  let carry = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += decoder.decode(value, { stream: true });
    const lines = carry.split('\n');
    carry = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try {
        const j = JSON.parse(t) as { message?: { content?: string } };
        const c = j.message?.content;
        if (typeof c === 'string' && c.length) yield c;
      } catch {
        /* skip bad line */
      }
    }
  }
  if (carry.trim()) {
    try {
      const j = JSON.parse(carry.trim()) as { message?: { content?: string } };
      const c = j.message?.content;
      if (typeof c === 'string' && c.length) yield c;
    } catch {
      /* */
    }
  }
}

async function* streamOpenAiCompatibleText(params: {
  system: string;
  user: string;
}): AsyncGenerator<string> {
  const base = (env.CHAT_OPENAI_COMPATIBLE_BASE_URL ?? '').trim();
  const key = (env.CHAT_OPENAI_COMPATIBLE_API_KEY ?? '').trim();
  const model = (env.CHAT_OPENAI_COMPATIBLE_MODEL ?? '').trim();
  if (!base || !key || !model) {
    throw new Error(
      '[chat] openai_compatible requires CHAT_OPENAI_COMPATIBLE_BASE_URL, CHAT_OPENAI_COMPATIBLE_API_KEY, and CHAT_OPENAI_COMPATIBLE_MODEL',
    );
  }
  const url = `${normalizeBaseUrl(base)}/v1/chat/completions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      stream: true,
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`[chat] OpenAI-compatible HTTP ${res.status}: ${errText.slice(0, 400)}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('[chat] OpenAI-compatible: empty body');
  const decoder = new TextDecoder();
  let carry = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    carry += decoder.decode(value, { stream: true });
    const lines = carry.split('\n');
    carry = lines.pop() ?? '';
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const data = t.replace(/^data:\s*/, '').trim();
      if (data === '[DONE]') continue;
      try {
        const j = JSON.parse(data) as {
          choices?: { delta?: { content?: string } }[];
        };
        const c = j.choices?.[0]?.delta?.content;
        if (typeof c === 'string' && c.length) yield c;
      } catch {
        /* skip */
      }
    }
  }
  if (carry.trim()) {
    const t = carry.trim();
    if (t.startsWith('data:')) {
      const data = t.replace(/^data:\s*/, '').trim();
      if (data && data !== '[DONE]') {
        try {
          const j = JSON.parse(data) as {
            choices?: { delta?: { content?: string } }[];
          };
          const c = j.choices?.[0]?.delta?.content;
          if (typeof c === 'string' && c.length) yield c;
        } catch {
          /* */
        }
      }
    }
  }
}

/**
 * Stream plain text deltas from the configured chat LLM (same prompt for all).
 * With CHAT_OLLAMA_FALLBACK=true, Anthropic failures automatically retry on Ollama.
 */
export async function* streamChatLlmText(params: {
  system: string;
  user: string;
}): AsyncGenerator<string> {
  const provider = getChatLlmProvider();
  if (provider === 'ollama') {
    yield* streamOllamaText(params);
    return;
  }
  if (provider === 'openai_compatible') {
    yield* streamOpenAiCompatibleText(params);
    return;
  }
  if (isOllamaFallbackEnabled()) {
    try {
      yield* streamAnthropicText(params);
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn('[chat] Anthropic failed; falling back to Ollama:', msg);
      yield* streamOllamaText(params);
      return;
    }
  }
  yield* streamAnthropicText(params);
}
