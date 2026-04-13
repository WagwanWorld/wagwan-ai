/**
 * Twin conversation memory (device + optional Supabase via /api/chat/thread).
 * v2: per-message ISO timestamps + compact card refs so the model can resolve "that link" later.
 */
import { browser } from '$app/environment';
import type { ResultCard } from '$lib/utils';

const STORAGE_PREFIX = 'wagwan_twin_chat_v1';

export const CHAT_MEMORY_VERSION = 2 as const;

/** Compact card snapshot for persistence and server context */
export interface StoredCardRef {
  title: string;
  url?: string;
  category?: string;
}

export interface StoredChatMessage {
  role: 'user' | 'ai';
  text: string;
  /** ISO-8601 when the message was sent / completed */
  at?: string;
  /** Last reply’s result cards (capped) — restores UI and grounds follow-ups */
  cardRefs?: StoredCardRef[];
}

export interface ChatMemoryState {
  version: 1 | 2;
  updatedAt: string;
  messages: StoredChatMessage[];
  summary?: string;
}

const MAX_MESSAGES = 40;
const MAX_CHARS = 120_000;
export const SUMMARY_EVERY_USER_TURNS = 10;
const MAX_CARD_REFS_PER_MSG = 8;
const MAX_TITLE_LEN = 140;
const MAX_URL_LEN = 600;

export function memoryKeyForProfile(profile: {
  name?: string;
  googleIdentity?: { email?: string } | null;
}): string {
  const base = profile.googleIdentity?.email || profile.name || 'anon';
  return `${STORAGE_PREFIX}_${simpleHash(String(base))}`;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function toCardRefs(cards: ResultCard[]): StoredCardRef[] {
  return cards.slice(0, MAX_CARD_REFS_PER_MSG).map(c => ({
    title: (c.title ?? '').slice(0, MAX_TITLE_LEN),
    url: c.url?.startsWith('http') ? c.url.slice(0, MAX_URL_LEN) : undefined,
    category: c.category,
  }));
}

/** Restore minimal ResultCard rows for UI from saved refs */
export function cardRefsToCards(refs?: StoredCardRef[]): ResultCard[] {
  if (!refs?.length) return [];
  return refs.map(r => ({
    title: r.title,
    description: '',
    price: '',
    url: r.url ?? '',
    category: (r.category as ResultCard['category']) || 'other',
    match_score: 72,
    match_reason: 'From a previous twin reply in this thread.',
    emoji: '🔗',
  }));
}

function migrateLoadedState(parsed: ChatMemoryState): ChatMemoryState {
  if (parsed.version === 2) return trimState(parsed);
  const fallbackAt = parsed.updatedAt || new Date().toISOString();
  return trimState({
    version: 2,
    updatedAt: parsed.updatedAt || fallbackAt,
    summary: parsed.summary,
    messages: (parsed.messages ?? []).map(m => ({
      role: m.role,
      text: m.text,
      at: m.at ?? fallbackAt,
      cardRefs: m.cardRefs,
    })),
  });
}

export function loadChatMemory(key: string): ChatMemoryState {
  if (!browser) return emptyState();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as ChatMemoryState;
    if (!Array.isArray(parsed.messages)) return emptyState();
    return migrateLoadedState(parsed);
  } catch {
    return emptyState();
  }
}

export function saveChatMemory(key: string, state: ChatMemoryState): void {
  if (!browser) return;
  try {
    const trimmed = trimState({
      ...state,
      version: 2,
      updatedAt: new Date().toISOString(),
    });
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {}
}

export function clearChatMemory(key: string): void {
  if (!browser) return;
  try {
    localStorage.removeItem(key);
  } catch {}
}

export function exportChatMemoryJson(state: ChatMemoryState): string {
  return JSON.stringify(state, null, 2);
}

/** Prefer the thread with the newer updatedAt (ISO lexicographic). */
export function pickNewerThread(local: ChatMemoryState, remote: unknown): ChatMemoryState {
  const a = local.updatedAt || '';
  if (!remote || typeof remote !== 'object') return migrateLoadedState(local);
  const r = remote as ChatMemoryState;
  if (!Array.isArray(r.messages)) return migrateLoadedState(local);
  const remoteNorm = migrateLoadedState(r);
  const b = remoteNorm.updatedAt || '';
  if (b > a) return remoteNorm;
  return migrateLoadedState(local);
}

function emptyState(): ChatMemoryState {
  return { version: 2, updatedAt: '', messages: [], summary: '' };
}

function trimCardRefs(refs?: StoredCardRef[]): StoredCardRef[] | undefined {
  if (!refs?.length) return undefined;
  return refs.slice(0, MAX_CARD_REFS_PER_MSG).map(x => ({
    title: x.title.slice(0, MAX_TITLE_LEN),
    url: x.url?.slice(0, MAX_URL_LEN),
    category: x.category,
  }));
}

function trimState(s: ChatMemoryState): ChatMemoryState {
  let msgs = s.messages.map(m => ({
    ...m,
    text: m.text,
    cardRefs: trimCardRefs(m.cardRefs),
  }));
  while (msgs.length > MAX_MESSAGES) msgs = msgs.slice(-MAX_MESSAGES);
  let chars = msgs.reduce((a, m) => a + m.text.length, 0);
  while (chars > MAX_CHARS && msgs.length > 2) {
    msgs = msgs.slice(1);
    chars = msgs.reduce((a, m) => a + m.text.length, 0);
  }
  return { ...s, version: 2, messages: msgs };
}

/** After this many new user messages since last summary, client may call /api/chat/summarize */
export function shouldRollSummary(prevUserCount: number, newUserCount: number): boolean {
  return newUserCount > 0 && Math.floor(newUserCount / SUMMARY_EVERY_USER_TURNS) > Math.floor(prevUserCount / SUMMARY_EVERY_USER_TURNS);
}
