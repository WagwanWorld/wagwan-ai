/**
 * Persistent twin identity memory — facts, preferences, and topics
 * learned from conversations. Grows over time as the user chats.
 *
 * Keyed per-profile so different accounts don't share memories.
 */
import { browser } from '$app/environment';

const STORAGE_PREFIX = 'wagwan_twin_memory_v1';

const MAX_FACTS = 50;
const MAX_PREFERENCES = 20;
const MAX_TOPICS = 10;

export const LEARN_EVERY_USER_TURNS = 3;

export interface IdentityOverride {
  field: string;
  value: string;
  source: 'chat';
  learnedAt: string;
}

export interface TwinMemoryState {
  version: 1;
  facts: string[];
  preferences: Record<string, string>;
  recentTopics: string[];
  identityOverrides: IdentityOverride[];
  learnedAt: string;
}

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
}

export function memoryKeyForProfile(profile: {
  name?: string;
  googleIdentity?: { email?: string } | null;
}): string {
  const base = profile.googleIdentity?.email || profile.name || 'anon';
  return `${STORAGE_PREFIX}_${simpleHash(String(base))}`;
}

const MAX_OVERRIDES = 30;

function emptyState(): TwinMemoryState {
  return { version: 1, facts: [], preferences: {}, recentTopics: [], identityOverrides: [], learnedAt: '' };
}

export function loadTwinMemory(key: string): TwinMemoryState {
  if (!browser) return emptyState();
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as TwinMemoryState;
    if (parsed.version !== 1) return emptyState();
    return trimState(parsed);
  } catch {
    return emptyState();
  }
}

export function saveTwinMemory(key: string, state: TwinMemoryState): void {
  if (!browser) return;
  try {
    const trimmed = trimState({ ...state, version: 1, learnedAt: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(trimmed));
  } catch {}
}

export function clearTwinMemory(key: string): void {
  if (!browser) return;
  try { localStorage.removeItem(key); } catch {}
}

/**
 * Merge newly learned facts/preferences into existing state, deduping.
 */
export function mergeLearnings(
  current: TwinMemoryState,
  incoming: {
    facts?: string[];
    preferences?: Record<string, string>;
    topics?: string[];
    identityOverrides?: IdentityOverride[];
  },
): TwinMemoryState {
  const existingLower = new Set(current.facts.map(f => f.toLowerCase().trim()));
  const newFacts = (incoming.facts ?? [])
    .map(f => f.trim())
    .filter(f => f.length > 3 && !existingLower.has(f.toLowerCase()));

  const mergedFacts = [...current.facts, ...newFacts];

  const mergedPrefs = { ...current.preferences };
  for (const [k, v] of Object.entries(incoming.preferences ?? {})) {
    if (k.trim() && v.trim()) mergedPrefs[k.trim().toLowerCase()] = v.trim();
  }

  const topicSet = new Set<string>();
  const mergedTopics: string[] = [];
  for (const t of [...(incoming.topics ?? []), ...current.recentTopics]) {
    const key = t.toLowerCase().trim();
    if (key && !topicSet.has(key)) {
      topicSet.add(key);
      mergedTopics.push(t.trim());
    }
  }

  // Merge identity overrides — newer overrides for the same field replace older ones
  const overrideMap = new Map<string, IdentityOverride>();
  for (const o of current.identityOverrides ?? []) overrideMap.set(o.field, o);
  for (const o of incoming.identityOverrides ?? []) overrideMap.set(o.field, o);
  const mergedOverrides = [...overrideMap.values()];

  return trimState({
    ...current,
    facts: mergedFacts,
    preferences: mergedPrefs,
    recentTopics: mergedTopics,
    identityOverrides: mergedOverrides,
    learnedAt: new Date().toISOString(),
  });
}

function trimState(s: TwinMemoryState): TwinMemoryState {
  const facts = s.facts.slice(-MAX_FACTS);
  const prefEntries = Object.entries(s.preferences);
  const preferences: Record<string, string> = {};
  for (const [k, v] of prefEntries.slice(-MAX_PREFERENCES)) preferences[k] = v;
  const recentTopics = s.recentTopics.slice(0, MAX_TOPICS);
  const identityOverrides = (s.identityOverrides ?? []).slice(-MAX_OVERRIDES);
  return { ...s, facts, preferences, recentTopics, identityOverrides };
}

/** Check if learning should trigger based on user message count. */
export function shouldLearn(prevUserCount: number, newUserCount: number): boolean {
  return newUserCount > 0 &&
    Math.floor(newUserCount / LEARN_EVERY_USER_TURNS) > Math.floor(prevUserCount / LEARN_EVERY_USER_TURNS);
}
