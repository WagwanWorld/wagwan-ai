/**
 * Client-side user profile store.
 * Persisted to localStorage so it survives page refreshes.
 * SSR-safe — only accesses localStorage in the browser.
 */

import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import type { InstagramIdentity } from '$lib/server/instagram';
import type { SpotifyIdentity, AppleMusicIdentity, YouTubeIdentity, LinkedInIdentity, GoogleIdentity } from '$lib/utils';
import { normalizeAppleMusicIdentity } from '$lib/utils';

export interface UserProfile {
  /**
   * Primary account id for Supabase (`user_profiles.google_sub`) and APIs.
   * Either a real Google OIDC `sub`, or `ig:<graphUserId>` / `ig:user:<username>` when Instagram-only.
   */
  googleSub: string;
  name: string;
  city: string;
  interests: string[];
  budget: 'low' | 'mid' | 'high';
  social: 'alone' | 'friends' | 'both';
  intents: string[];
  setupComplete: boolean;
  instagramConnected: boolean;
  instagramIdentity: InstagramIdentity | null;
  spotifyConnected: boolean;
  spotifyIdentity: SpotifyIdentity | null;
  appleMusicConnected: boolean;
  appleMusicIdentity: AppleMusicIdentity | null;
  youtubeConnected: boolean;
  youtubeIdentity: YouTubeIdentity | null;
  googleConnected: boolean;
  googleIdentity: GoogleIdentity | null;
  googleAccessToken: string;
  googleRefreshToken: string;
  linkedinConnected: boolean;
  linkedinIdentity: LinkedInIdentity | null;
  savedItems: SavedItem[];
  savingsTotal: number;
  lastVisit: string;
  profileUpdatedAt: string;
}

export interface SavedItem {
  id: string;
  title: string;
  url: string;
  category: string;
  emoji: string;
  savedAt: string;
}

const DEFAULT_PROFILE: UserProfile = {
  googleSub: '',
  name: '',
  city: '',
  interests: [],
  budget: 'mid',
  social: 'both',
  intents: [],
  setupComplete: false,
  instagramConnected: false,
  instagramIdentity: null,
  spotifyConnected: false,
  spotifyIdentity: null,
  appleMusicConnected: false,
  appleMusicIdentity: null,
  youtubeConnected: false,
  youtubeIdentity: null,
  googleConnected: false,
  googleIdentity: null,
  googleAccessToken: '',
  googleRefreshToken: '',
  linkedinConnected: false,
  linkedinIdentity: null,
  savedItems: [],
  savingsTotal: 0,
  lastVisit: '',
  profileUpdatedAt: '',
};

const STORAGE_KEY = 'wagwan_profile_v2';

function load(): UserProfile {
  if (!browser) return { ...DEFAULT_PROFILE };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    const parsed = { ...DEFAULT_PROFILE, ...JSON.parse(raw) } as UserProfile;
    if (parsed.appleMusicIdentity) {
      parsed.appleMusicIdentity = normalizeAppleMusicIdentity(parsed.appleMusicIdentity);
    }
    return parsed;
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

function persist(p: UserProfile) {
  if (browser) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); } catch {}
  }
}

function createStore() {
  const { subscribe, set, update } = writable<UserProfile>(load());

  const withNormApple = (p: UserProfile): UserProfile =>
    p.appleMusicIdentity
      ? { ...p, appleMusicIdentity: normalizeAppleMusicIdentity(p.appleMusicIdentity) }
      : p;

  return {
    subscribe,
    set(value: UserProfile) {
      const next = withNormApple(value);
      persist(next);
      set(next);
    },
    update(fn: (v: UserProfile) => UserProfile) {
      update(v => {
        const next = withNormApple(fn(v));
        persist(next);
        return next;
      });
    },
    save(item: SavedItem) {
      update(p => {
        const already = p.savedItems.some(s => s.id === item.id);
        if (already) return p;
        const next = { ...p, savedItems: [item, ...p.savedItems] };
        persist(next);
        return next;
      });
    },
    unsave(id: string) {
      update(p => {
        const next = { ...p, savedItems: p.savedItems.filter(s => s.id !== id) };
        persist(next);
        return next;
      });
    },
    isSaved(id: string): boolean {
      let saved = false;
      // Synchronous check using the current value
      const unsub = this.subscribe(p => { saved = p.savedItems.some(s => s.id === id); });
      unsub();
      return saved;
    },
    reset() {
      if (browser) localStorage.removeItem(STORAGE_KEY);
      set({ ...DEFAULT_PROFILE });
    },
  };
}

export const profile = createStore();
