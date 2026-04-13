export const AGENT_TYPES = ['gmail', 'instagram', 'calendar', 'twin', 'culture'] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

export const AGENT_LABELS: Record<AgentType, string> = {
  gmail: 'Gmail',
  instagram: 'Instagram',
  calendar: 'Calendar',
  twin: 'Twin',
  culture: 'Culture',
};

/** Shown on Chats as quick-start tiles (subset of full agent list). */
export const FEATURED_AGENT_TYPES = ['twin', 'gmail', 'instagram'] as const satisfies readonly AgentType[];

export const AGENT_TAGLINES: Record<AgentType, string> = {
  twin: 'Your main AI — plans, taste, and context across everything.',
  gmail: 'Summaries, drafts, and what needs a reply.',
  instagram: 'Captions, growth ideas, and your aesthetic.',
  calendar: 'Schedule, conflicts, and what’s next.',
  culture: 'Food, nightlife, and what’s on near you.',
};

export function isAgentType(s: string): s is AgentType {
  return (AGENT_TYPES as readonly string[]).includes(s);
}
