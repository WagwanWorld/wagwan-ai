/**
 * Conversation-first home chips: time-aware defaults + twin starters.
 */
import type { TwinUiContext } from '$lib/stores/contextStore';
import { buildTwinStarters, type TwinStarter } from './twinStarters';

export interface HomeConversationChip {
  emoji: string;
  label: string;
  query: string;
}

type StarterProfileArg = Parameters<typeof buildTwinStarters>[1];

function periodFromContext(ctx: TwinUiContext): 'morning' | 'afternoon' | 'evening' {
  return ctx.greetingPeriod;
}

const DEFAULT_CHIPS: HomeConversationChip[] = [
  { emoji: '🍽', label: 'Find dinner', query: 'Find me a great dinner spot that fits my vibe' },
  { emoji: '🍷', label: 'Chill plans', query: 'Suggest something chill I could do in the next few hours' },
  { emoji: '⚡', label: 'Quick nearby', query: 'Quick fun things near me right now' },
  { emoji: '🎧', label: 'Music for now', query: 'Music that matches my mood right now' },
  { emoji: '✨', label: 'Surprise me', query: 'Surprise me with one concrete idea for today' },
];

const MORNING_EXTRA: HomeConversationChip = {
  emoji: '☕',
  label: 'Start the day',
  query: 'Help me ease into the day — one small win and something nice to look forward to',
};

const EVENING_EXTRA: HomeConversationChip = {
  emoji: '🌙',
  label: 'Wind down',
  query: 'Help me wind down this evening in a way that fits my vibe',
};

function starterToChip(s: TwinStarter, emoji: string): HomeConversationChip {
  return { emoji, label: s.label, query: s.query };
}

export function buildHomeConversationChips(
  city: string,
  profile: StarterProfileArg,
  ctx: TwinUiContext,
): HomeConversationChip[] {
  const period = periodFromContext(ctx);
  const starters = buildTwinStarters(city || 'my city', profile).slice(0, 3);
  const starterEmojis = ['🎯', '💡', '📌'];
  const fromStarters = starters.map((s, i) => starterToChip(s, starterEmojis[i] ?? '✨'));

  let seeds: HomeConversationChip[] = [...DEFAULT_CHIPS];
  if (period === 'morning') seeds = [MORNING_EXTRA, ...seeds];
  if (period === 'evening') seeds = [EVENING_EXTRA, ...seeds];

  const seen = new Set<string>();
  const out: HomeConversationChip[] = [];
  for (const c of [...fromStarters, ...seeds]) {
    const k = c.query.slice(0, 80).toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(c);
    if (out.length >= 6) break;
  }
  return out.slice(0, 6);
}
