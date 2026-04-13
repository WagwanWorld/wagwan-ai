/**
 * Shared reactive feed cache.
 *
 * Holds in-memory copies of all feed data (recs, news, calendar, gmail, etc.)
 * so navigation between Home and Explore is instant for already-fetched data.
 * Falls through to localStorage for cross-reload persistence, then to network.
 */
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import type { ResultCard as Card } from '$lib/utils';
import type { CalendarEvent } from '$lib/server/google';

export interface NewsFact {
  fact: string;
  url: string;
  source: string;
  topic: string;
  emoji: string;
}

export interface FeedState {
  recs: Card[];
  recsMessage: string;
  news: NewsFact[];
  calendar: CalendarEvent[];
  gmail: string[];
  videos: Card[];
  tribe: Card[];
  events: Card[];
  shop: Card[];
}

const EMPTY: FeedState = {
  recs: [],
  recsMessage: '',
  news: [],
  calendar: [],
  gmail: [],
  videos: [],
  tribe: [],
  events: [],
  shop: [],
};

export const feedCache = writable<FeedState>({ ...EMPTY });

export function updateFeed(partial: Partial<FeedState>) {
  feedCache.update(s => ({ ...s, ...partial }));
}

export function getFeed(): FeedState {
  return get(feedCache);
}

export function resetFeedCache() {
  feedCache.set({ ...EMPTY });
}

export function todaySlotKey(key: string): string {
  const d = new Date();
  const slot = Math.floor(d.getHours() / 6);
  return `wagwan_home_v8_${key}_${d.getFullYear()}${d.getMonth()}${d.getDate()}_${slot}`;
}

export function googleSlotKey(sub: string): string {
  const d = new Date();
  const slot = Math.floor(d.getHours() / 2);
  return `wagwan_google_${sub}_${d.getFullYear()}${d.getMonth()}${d.getDate()}_${slot}`;
}

export function getCachedLocal<T>(key: string): T | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(todaySlotKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T;
    if (parsed && typeof parsed === 'object' && 'cards' in parsed) {
      if (Array.isArray((parsed as { cards: unknown[] }).cards) && (parsed as { cards: unknown[] }).cards.length === 0) return null;
    }
    return parsed;
  } catch { return null; }
}

export function setCachedLocal(key: string, data: unknown) {
  if (!browser) return;
  if (data && typeof data === 'object' && 'cards' in data) {
    const cards = (data as { cards: unknown[] }).cards;
    if (!Array.isArray(cards) || cards.length === 0) return;
  }
  try {
    const current = todaySlotKey(key);
    Object.keys(localStorage)
      .filter(k => k.startsWith('wagwan_home_') && k !== current)
      .forEach(k => localStorage.removeItem(k));
    localStorage.setItem(current, JSON.stringify(data));
  } catch {}
}

export function getGoogleCachedLocal<T>(sub: string): T | null {
  if (!browser) return null;
  try {
    const raw = localStorage.getItem(googleSlotKey(sub));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setGoogleCachedLocal(sub: string, data: unknown) {
  if (!browser) return;
  try {
    const cur = googleSlotKey(sub);
    Object.keys(localStorage)
      .filter(k => k.startsWith(`wagwan_google_${sub}_`) && k !== cur)
      .forEach(k => localStorage.removeItem(k));
    localStorage.setItem(cur, JSON.stringify(data));
  } catch {}
}
