/**
 * Client-side reminders store — persisted in localStorage.
 * Used by home feed and AI chat (reminder creation from conversation).
 */
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface Reminder {
  id: string;
  text: string;
  time?: string;       // ISO datetime string (optional)
  emoji: string;
  done: boolean;
  createdAt: string;
}

const KEY = 'wagwan_reminders_v1';

function load(): Reminder[] {
  if (!browser) return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function persist(items: Reminder[]) {
  if (browser) try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
}

function createStore() {
  const { subscribe, update, set } = writable<Reminder[]>(load());

  return {
    subscribe,
    add(text: string, time?: string, emoji = '🔔') {
      const reminder: Reminder = {
        id: crypto.randomUUID(),
        text: text.trim(),
        time,
        emoji,
        done: false,
        createdAt: new Date().toISOString(),
      };
      update(items => {
        const next = [reminder, ...items];
        persist(next);
        return next;
      });
    },
    complete(id: string) {
      update(items => {
        const next = items.map(r => r.id === id ? { ...r, done: true } : r);
        persist(next);
        return next;
      });
    },
    remove(id: string) {
      update(items => {
        const next = items.filter(r => r.id !== id);
        persist(next);
        return next;
      });
    },
    toggle(id: string) {
      update(items => {
        const next = items.map(r => r.id === id ? { ...r, done: !r.done } : r);
        persist(next);
        return next;
      });
    },
  };
}

export const reminders = createStore();
