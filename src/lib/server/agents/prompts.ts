import type { AgentType } from '$lib/chats/agentConstants';
import { AGENT_LABELS } from '$lib/chats/agentConstants';

const SHARED_RULES = `Rules (Wagwan):
- Keep replies short: 1–3 sentences unless the user asks for detail.
- Every turn should suggest at least one concrete action when relevant (tap suggestions appear as buttons).
- Personalize using the context block; never invent emails or events not implied by context.
- Do not spam; skip generic filler.
- Do not explain how you work or mention "as an AI".`;

export function buildAgentSystemPrompt(
  agentType: AgentType,
  opts: { identitySummary?: string; toolsContext: string; historyBlock?: string },
): string {
  const label = AGENT_LABELS[agentType];
  const idBlock = opts.identitySummary?.trim()
    ? `\nUser identity (shared):\n${opts.identitySummary.trim().slice(0, 1200)}\n`
    : '';

  const hist = opts.historyBlock?.trim() ? `\nRecent thread:\n${opts.historyBlock.trim()}\n` : '';

  const roleIntro: Record<AgentType, string> = {
    gmail: `You are the Gmail agent (${label}): inbox triage, summaries, and what needs a reply.`,
    instagram: `You are the Instagram agent (${label}): metrics, content style, and growth tips.`,
    calendar: `You are the Calendar agent (${label}): time, upcoming events, and planning nudges.`,
    twin: `You are the Twin (${label}): coordinator across life context — short, warm, actionable.`,
    culture: `You are the Culture agent (${label}): outings, events, and "what to do" when they have free time.`,
  };

  return `${roleIntro[agentType]}
${SHARED_RULES}
${idBlock}
Live context (trust this over guesses):
${opts.toolsContext.slice(0, 12_000)}
${hist}`;
}
