/**
 * Claude AI helpers — chat + home recommendations.
 *
 * The AI is lifestyle-first: music, food, experiences, nightlife, culture.
 * Deals are one category among many — not the default lens.
 */

import Anthropic from '@anthropic-ai/sdk';
import type {
  Message,
  MessageParam,
  Tool,
  ToolResultBlockParam,
  ToolUseBlock,
} from '@anthropic-ai/sdk/resources/messages/messages.js';
import { IDENTITY_MEMORY_TOOLS, executeIdentityMemoryTool } from '$lib/server/identityClaims/identityTools';
import { buildContext } from '$lib/server/identityContext/buildContext';
import {
  CONTEXT_PACK_SYSTEM_ADDENDUM,
  formatCompressedContextForPrompt,
} from '$lib/server/identityContext/formatContextPrompt';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import { env as privateEnv } from '$env/dynamic/private';
import type { InstagramIdentity } from './instagram';
import type { ResultCard, ChatResponse, TwinChatAction } from '$lib/utils';
import {
  buildIdentityGraph,
  formatSignalPackForChat,
  identitySummary,
  SIGNAL_PACK_MAX_CHARS_DEFAULT,
  type IdentityGraph,
} from './identity';
import {
  getAnthropicChatModel,
  getChatLlmProvider,
  streamChatLlmText,
} from '$lib/server/llm/chatProviders';
import {
  attachResultThumbnails,
  sanitizeCardsToSearchResults,
  type SearchResult,
} from './search';

export type { ResultCard, ChatResponse };

/** Browse routing from chat +server (search-backed result cards). */
export type BrowseIntent = 'event' | 'music' | 'food' | 'general';

const BROWSE_CARD_MIN_RESULTS = 2;

const EMIT_HOME_RECS_TOOL: Tool = {
  name: 'emit_home_recommendations',
  description:
    'Return the home feed: one short message plus 4–8 hyper-personalised cards. Every card url must be copied verbatim from the search results in the user message.',
  input_schema: {
    type: 'object',
    properties: {
      message: { type: 'string', description: 'One short headline for the feed section.' },
      cards: {
        type: 'array',
        description: '4–8 cards spanning music, food, events, fashion/wellness, and professional picks where relevant.',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            price: { type: 'string' },
            url: { type: 'string' },
            category: { type: 'string' },
            match_score: { type: 'number' },
            match_reason: { type: 'string' },
            emoji: { type: 'string' },
            image_hint: { type: 'string' },
            image_url: { type: 'string' },
          },
          required: ['title', 'description', 'url', 'category', 'match_score', 'match_reason', 'emoji'],
        },
      },
    },
    required: ['message', 'cards'],
  },
};

export function extractToolUseInput<T>(content: Message['content'], toolName: string): T | null {
  for (const block of content) {
    if (block.type === 'tool_use' && block.name === toolName) {
      return block.input as T;
    }
  }
  return null;
}

export function buildFallbackCardsFromSearchResults(results: SearchResult[]): ResultCard[] {
  const slice = results.filter(r => r.url?.trim().startsWith('http')).slice(0, 3);
  return slice.map(r => ({
    title: r.title.slice(0, 200),
    description: (r.description?.trim() || r.title).slice(0, 320),
    price: '',
    url: r.url,
    category: 'other' as const,
    match_score: 74,
    match_reason: 'Pulled from live search for your query.',
    emoji: '🔗',
  }));
}

/** Cap wait so SSE chat cannot hang for the SDK default (~10m) if the API stalls. */
const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY, timeout: 90_000 });

// ── System prompt builder ──────────────────────────────────────────────────

interface YouTubeLike {
  topChannels?: string[];
  topCategories?: string[];
  contentPersonality?: string;
  lifestyleSignals?: string[];
  emailThemes?: string[];
  importantSenders?: string[];
  twin?: import('$lib/utils').GoogleTwin;
}
interface LinkedInLike {
  headline?: string;
  currentRole?: string;
  currentCompany?: string;
  seniority?: string;
  industry?: string;
  skills?: string[];
  careerSummary?: string;
  location?: string;
}

export interface LearnedMemory {
  facts?: string[];
  preferences?: Record<string, string>;
  recentTopics?: string[];
  identityOverrides?: { field: string; value: string; source: string; learnedAt: string }[];
}

function buildSystemPrompt(profile: {
  interests?: string[];
  budget?: string;
  social?: string;
  city?: string;
  instagramIdentity?: InstagramIdentity | null;
  spotifyIdentity?: { topArtists?: string[]; topGenres?: string[]; topTracks?: string[]; musicPersonality?: string; vibeDescription?: string } | null;
  appleMusicIdentity?: {
    topArtists?: string[];
    topGenres?: string[];
    musicPersonality?: string;
    vibeDescription?: string;
    rotationPlaylists?: string[];
    libraryPlaylists?: string[];
    latestReleases?: { artistName?: string; title?: string; releaseDate?: string }[];
  } | null;
  googleIdentity?: YouTubeLike | null;
  youtubeIdentity?: YouTubeLike | null;
  linkedinIdentity?: LinkedInLike | null;
}, learnedMemory?: LearnedMemory, precomputed?: { graph?: IdentityGraph | null; summary?: string | null }): string {
  const ig = profile.instagramIdentity;
  const sp = profile.spotifyIdentity;
  const am = profile.appleMusicIdentity;
  const yt = profile.googleIdentity ?? profile.youtubeIdentity; // googleIdentity is richer
  const li = profile.linkedinIdentity;
  const budgetMap: Record<string, string> = {
    low: 'budget-conscious (prefers under ₹500)',
    mid: 'mid-range (₹500–₹3000 sweet spot)',
    high: 'premium (happy to spend for quality)',
  };
  const budgetDesc = budgetMap[profile.budget ?? 'mid'] ?? budgetMap.mid;

  const spotifyBlock = sp?.topArtists?.length
    ? `\nSpotify (REAL listening data — highest priority for music picks):
  Top artists: ${sp.topArtists.slice(0, 4).join(', ')}
  Top genres: ${(sp.topGenres ?? []).slice(0, 4).join(', ')}
  Top tracks: ${(sp.topTracks ?? []).slice(0, 3).join(' | ')}
  Music personality: ${(sp.musicPersonality ?? '').slice(0, 200)}
  Vibe: ${(sp.vibeDescription ?? '').slice(0, 200)}`
    : '';

  const hasAppleMusic =
    (am?.topArtists?.length ?? 0) > 0 ||
    (am?.rotationPlaylists?.length ?? 0) > 0 ||
    (am?.libraryPlaylists?.length ?? 0) > 0 ||
    (am?.latestReleases?.length ?? 0) > 0;
  const appleMusicBlock =
    am && hasAppleMusic
      ? `\nApple Music (REAL library + rotation data):
  Heavy rotation artists: ${(am.topArtists ?? []).slice(0, 4).join(', ') || '—'}
  Playlists on repeat: ${(am.rotationPlaylists ?? []).slice(0, 5).join(', ') || '—'}
  Library playlists (sample): ${(am.libraryPlaylists ?? []).slice(0, 5).join(', ') || '—'}
  Newest catalog drops (from those artists): ${(am.latestReleases ?? []).slice(0, 4).map(r => `${r.artistName ?? '?'}: ${r.title ?? ''}`).join('; ') || '—'}
  Genres: ${(am.topGenres ?? []).slice(0, 4).join(', ')}
  Music personality: ${(am.musicPersonality ?? '').slice(0, 200)}
  Vibe: ${(am.vibeDescription ?? '').slice(0, 200)}`
      : '';

  const youtubeBlock =
    yt?.lifestyleSignals?.length ||
    yt?.topChannels?.length ||
    yt?.contentPersonality ||
    yt?.emailThemes?.length
      ? `\nYouTube (subscriptions & watch patterns — trust channels/categories first):
  Subscribed channels: ${(yt.topChannels ?? []).slice(0, 6).join(', ')}
  Content categories: ${(yt.topCategories ?? []).slice(0, 6).join(', ')}
  Lifestyle signals: ${(yt.lifestyleSignals ?? []).slice(0, 5).join(', ')}
  Content personality: ${(yt.contentPersonality ?? '').slice(0, 200)}
  Activity themes (short phrases): ${(yt.emailThemes ?? []).slice(0, 4).join(' | ')}`
      : '';

  const gTwin = profile.googleIdentity?.twin;
  const googleRhythmBlock = gTwin
    ? `\nCurrent rhythm (use for timing and tone in replies; do not say you read mail or calendar):
  ${gTwin.insights.slice(0, 5).map(i => `- ${i}`).join('\n  ')}
  Planning style: ${gTwin.personality.structuredVsSpontaneous}; week load: ${gTwin.lifestyle.workIntensity}.
  Next commitment: ${gTwin.intent.nextEventTitle ? `${gTwin.intent.nextEventTitle}` : 'nothing urgent flagged'}${gTwin.intent.plansHint ? ` (${gTwin.intent.plansHint})` : ''}.`
    : '';

  const linkedinBlock = li?.currentRole || li?.headline
    ? `\nLinkedIn (professional context):
  Headline: ${(li.headline ?? '').slice(0, 120)}
  Role: ${li.currentRole ?? ''} at ${li.currentCompany ?? ''}
  Location: ${li.location ?? ''}
  Seniority: ${li.seniority ?? ''}
  Industry: ${li.industry ?? ''}
  Skills: ${(li.skills ?? []).slice(0, 8).join(', ')}
  Career: ${(li.careerSummary ?? '').slice(0, 280)}`
    : '';

  const musicOverrideNote = (sp || am) ? ' (see platform data below for real listening signals)' : '';

  // Build enriched IG block with new signals
  const igBase = ig
    ? `Instagram identity (@${ig.username ?? ''}):
  Aesthetic: ${ig.aesthetic ?? ''}
  Lifestyle: ${ig.lifestyle ?? ''}
  Interests: ${(ig.interests ?? []).join(', ')}
  Brand vibes: ${(ig.brandVibes ?? []).join(', ')}
  Music vibe: ${ig.musicVibe ?? ''}${musicOverrideNote}
  Food vibe: ${ig.foodVibe ?? ''}
  Travel style: ${ig.travelStyle ?? ''}
  Active: ${ig.activityPattern ?? ''}
  Caption tags: ${(ig.topHashtags ?? []).slice(0, 6).join(', ') || '—'}
  Summary: ${(ig.rawSummary ?? '').slice(0, 220)}`
    : `Manually selected interests: ${(profile.interests ?? []).slice(0, 8).join(', ') || 'general lifestyle'}`;

  // Enriched signals from visual/temporal/engagement analysis
  type IgEnriched = typeof ig & {
    visual?: { cuisineTypes?: string[]; locationTypes?: string[]; fashionStyle?: string; aesthetic?: { tone?: string; brightness?: string } };
    personality?: { expressive: number; humor: number; introspective: number };
    temporal?: { activityPattern?: string; peakDays?: string[] };
    engagement?: { engagementTier?: string; socialVisibility?: string };
    commentGraph?: { externalPerception?: string[]; communityTone?: string };
    bioRoles?: string[];
  };
  const igE = ig as IgEnriched | null;

  const visualBlock = igE?.visual
    ? `\n  Visual identity (from photo analysis):
  Fashion style: ${igE.visual.fashionStyle ?? '—'}
  Cuisine types: ${(igE.visual.cuisineTypes ?? []).join(', ') || '—'}
  Location types: ${(igE.visual.locationTypes ?? []).join(', ') || '—'}
  Photo tone: ${igE.visual.aesthetic?.tone ?? '—'}, brightness: ${igE.visual.aesthetic?.brightness ?? '—'}`
    : '';

  const personalityBlock = igE?.personality
    ? `\n  Personality: expressive=${igE.personality.expressive} humor=${igE.personality.humor} introspective=${igE.personality.introspective}`
    : '';

  const temporalBlock = igE?.temporal?.activityPattern
    ? `\n  Most active: ${igE.temporal.activityPattern}${igE.temporal.peakDays?.length ? `, peak days: ${igE.temporal.peakDays.join(', ')}` : ''}`
    : '';

  const engagementBlock = igE?.engagement
    ? `\n  Engagement: ${igE.engagement.engagementTier ?? '—'} | Visibility: ${igE.engagement.socialVisibility ?? '—'}`
    : '';

  const perceptionBlock = igE?.commentGraph?.externalPerception?.length
    ? `\n  Others see them as: ${igE.commentGraph.externalPerception.join(', ')} (tone: ${igE.commentGraph.communityTone ?? 'mixed'})`
    : '';

  const rolesBlock = igE?.bioRoles?.length
    ? `\n  Self-described roles: ${igE.bioRoles.join(', ')}`
    : '';

  const identityBlock = `${igBase}${visualBlock}${personalityBlock}${temporalBlock}${engagementBlock}${perceptionBlock}${rolesBlock}${spotifyBlock}${appleMusicBlock}${youtubeBlock}${googleRhythmBlock}${linkedinBlock}`;

  const graphSummary = precomputed?.summary || identitySummary(precomputed?.graph ?? buildIdentityGraph(profile as Parameters<typeof buildIdentityGraph>[0]));

  const memFacts = learnedMemory?.facts?.length
    ? `\nLearned from past conversations (use this to personalise — these are things you've learned about the user over time):\n${learnedMemory.facts
        .slice(0, 12)
        .map(f => `- ${String(f).slice(0, 160)}`)
        .join('\n')}`
    : '';
  const memPrefs = learnedMemory?.preferences && Object.keys(learnedMemory.preferences).length
    ? `\nUser preferences (learned):\n${Object.entries(learnedMemory.preferences)
        .slice(0, 10)
        .map(([k, v]) => `- ${k}: ${String(v).slice(0, 80)}`)
        .join('\n')}`
    : '';
  const memTopics = learnedMemory?.recentTopics?.length
    ? `\nRecent conversation topics: ${learnedMemory.recentTopics.slice(0, 8).join(', ')}`
    : '';
  // Identity overrides from chat
  const memOverrides = learnedMemory?.identityOverrides?.length
    ? `\nIdentity corrections (user explicitly stated these — always prioritise over inferred signals):\n${learnedMemory.identityOverrides.map((o: { field: string; value: string }) => `- ${o.field}: ${o.value}`).join('\n')}`
    : '';
  const learnedBlock = (memFacts || memPrefs || memTopics || memOverrides)
    ? `${memFacts}${memPrefs}${memTopics}${memOverrides}\n`
    : '';

  // Subtle probing: when identity signals are weak, nudge the twin to naturally ask
  const igE2 = ig as typeof ig & {
    personality?: { expressive: number };
    visual?: { sceneCategories?: Record<string, number> };
    engagement?: { engagementTier?: string };
  } | null;
  const probeHints: string[] = [];
  if (!ig?.foodVibe && !igE2?.visual?.sceneCategories?.['food']) {
    probeHints.push('food preferences');
  }
  if (!ig?.musicVibe && !profile.spotifyIdentity?.topArtists?.length) {
    probeHints.push('music taste');
  }
  if (igE2?.engagement?.engagementTier === 'low' && !ig?.interests?.length) {
    probeHints.push('interests and hobbies');
  }
  const probeBlock = probeHints.length > 0
    ? `\nLow-confidence signals: ${probeHints.join(', ')}. When relevant, naturally weave in a question to learn more (e.g., "what kind of food are you into lately?" or "been listening to anything good?"). Don't force it — only ask when it flows naturally in conversation.\n`
    : '';

  return `You are the user's digital twin inside Wagwan — you know them deeply through their social signals and past conversations. Speak in first person when standing in for them ("I'd pick…", "Here's what I'd send…"). You plan, draft, summarise, narrow choices, and give direct verdicts — not lists of options.

Compact identity (ground every answer here): ${graphSummary}

User profile:
${identityBlock}
  Budget: ${budgetDesc}
  Social style: ${profile.social ?? 'social'}
${learnedBlock}${probeBlock}
Voice:
- You ARE their twin. Don't say "here are some options" — say "I'd go with X because you love Y".
- Give a direct, opinionated answer. The user should get value from your message alone without clicking any link.
- When recommending a place/product/event: state the name, why it fits them, key details (price, location, time), and your verdict.
- Be warm and personal, but concise. 2–3 sentences max for the message.
- If rhythm/context above applies, you may start with one short natural nod (e.g. packed day, plans later) before your pick — never mention data sources.
- Sensitive or irreversible actions: propose only; never claim you already sent email or money.

Intent handling (same response):
- Plan / organise: structured steps, times optional.
- Draft text: give copy-ready text in "message"; cards optional.
- Summarise / decide: clear takeaway, pick one best option.
- Find / show: give your TOP 1–2 picks, not a catalogue. Quality over quantity.

Return ONE JSON object (no markdown, pure JSON):

{
  "message": "Direct, personal verdict — 2–3 sentences. State your pick and why.",
  "mood": "warm|excited|thoughtful|neutral|sorry",
  "suggested_followups": ["short chip 1", "short chip 2", "short chip 3"],
  "actions": [],
  "cards": [
    {
      "title": "Exact name (artist, venue, product, place)",
      "description": "1 sentence. Why this fits THEM specifically.",
      "price": "Exact price, 'Free', 'From ₹X', or 'Tickets from ₹X'",
      "url": "Real URL from Tier C live web results when present — use actual links",
      "category": "music|food|nightlife|fitness|fashion|travel|experience|deal|tech|wellness|culture|product|other",
      "match_score": 88,
      "match_reason": "One sentence referencing their specific interests/aesthetic",
      "emoji": "single relevant emoji",
      "image_hint": "2-3 word scene description for gradient",
      "image_url": "If the result line includes Thumbnail: use that exact URL when it matches this card's URL; else use a URL from Available images; else empty string"
    }
  ]
}

Optional "actions" (only when clearly helpful; user must confirm in UI):
- {"type":"set_reminder","text":"...","when":"ISO or human time"}
- {"type":"navigate","path":"/profile"}
- {"type":"copy_text","text":"..."}
- {"type":"gmail_draft","to":"email","subject":"...","body":"..."} — only if user asked for email help; they confirm before any API send.

Rules:
- Return 1–2 cards maximum. Pick THE best option — you are their twin, not a search engine. Only add a second card if there's a genuine alternative worth considering.
- Use [] for cards if the task is purely planning/drafting with no URLs.
- suggested_followups: 2–4 short strings; conversational continuations (e.g. "Book it", "Cheaper option", "Something else").
- mood: match tone of the reply.
- PRIORITISE lifestyle over deals. Only use category "deal" if the query is explicitly about saving money.
- match_score 65–98; match_reason must cite concrete identity facts when data exists.
- Use REAL URLs from Tier C live web results for cards when web search ran; otherwise cards: [].
- For results tagged [EVENT LISTING]: extract event name, venue, date; bookable links; category "nightlife" or "experience".
- Never start with "Here are" or "I found" — give your pick directly, like a friend would.`;
}

// ── Chat endpoint ──────────────────────────────────────────────────────────

export async function generateChatResponse(
  message: string,
  searchContext: string,
  profile: {
    interests?: string[];
    budget?: string;
    social?: string;
    instagramIdentity?: InstagramIdentity | null;
    spotifyIdentity?: { topArtists: string[]; topGenres: string[]; topTracks: string[]; musicPersonality: string; vibeDescription: string } | null;
    appleMusicIdentity?: {
      topArtists: string[];
      topGenres: string[];
      musicPersonality: string;
      vibeDescription: string;
      rotationPlaylists?: string[];
      libraryPlaylists?: string[];
      latestReleases?: { artistName?: string; title?: string; releaseDate?: string }[];
    } | null;
    youtubeIdentity?: { topChannels: string[]; topCategories: string[]; contentPersonality: string; lifestyleSignals: string[] } | null;
    linkedinIdentity?: { currentRole: string; currentCompany: string; seniority: string; industry: string; skills: string[]; careerSummary: string } | null;
  },
  sourceResults?: SearchResult[],
  options?: { googleSub?: string | null },
): Promise<ChatResponse> {
  const systemPrompt = buildSystemPrompt(profile);

  let contextPackBlock = '';
  try {
    if (options?.googleSub?.trim()) {
      const pack = await buildContext(options.googleSub.trim(), message);
      contextPackBlock = formatCompressedContextForPrompt(pack);
    }
  } catch {
    /* ignore */
  }

  const systemAugmented = contextPackBlock
    ? `${systemPrompt}\n\n${CONTEXT_PACK_SYSTEM_ADDENDUM}`
    : systemPrompt;

  const userContent = `Query: "${message}"
${contextPackBlock}
Real web search results:
${searchContext}

Return the JSON response.`;

  try {
    const response = await anthropic.messages.create({
      model: getAnthropicChatModel(),
      max_tokens: 2400,
      system: systemAugmented,
      messages: [{ role: 'user', content: userContent }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const parsed = parseJsonResponse(text);
    let cards = sanitizeCardsToSearchResults(parsed.cards ?? [], sourceResults ?? []);
    if (!cards.length && (sourceResults?.length ?? 0) >= 2) {
      cards = buildFallbackCardsFromSearchResults(sourceResults ?? []);
    }
    if (!parsed.cards?.length) console.error('Chat returned no cards. Raw:', text.slice(0, 500));
    return {
      message: parsed.message,
      cards: attachResultThumbnails(cards, sourceResults ?? []),
    };
  } catch (e) {
    console.error('Claude chat error:', e);
    return { message: "I had trouble finding results — try rephrasing?", cards: [] };
  }
}

// ── Home recommendations ───────────────────────────────────────────────────

export async function generateHomeRecommendations(
  searchContext: string,
  profile: {
    interests?: string[];
    budget?: string;
    social?: string;
    instagramIdentity?: InstagramIdentity | null;
    spotifyIdentity?: { topArtists: string[]; topGenres: string[]; topTracks: string[]; musicPersonality: string; vibeDescription: string } | null;
    appleMusicIdentity?: {
      topArtists: string[];
      topGenres: string[];
      musicPersonality: string;
      vibeDescription: string;
      rotationPlaylists?: string[];
      libraryPlaylists?: string[];
      latestReleases?: { artistName?: string; title?: string; releaseDate?: string }[];
    } | null;
    youtubeIdentity?: { topChannels: string[]; topCategories: string[]; contentPersonality: string; lifestyleSignals: string[] } | null;
    linkedinIdentity?: { currentRole: string; currentCompany: string; seniority: string; industry: string; skills: string[]; careerSummary: string } | null;
  },
  sourceResults?: SearchResult[],
  precomputed?: {
    graph?: IdentityGraph | null;
    summary?: string | null;
    googleSub?: string | null;
  },
): Promise<ChatResponse> {
  const systemPrompt = buildSystemPrompt(profile, undefined, precomputed);
  const ig = profile.instagramIdentity;
  const sp = profile.spotifyIdentity;

  const vibeDesc = ig
    ? `${ig.aesthetic ?? ''} aesthetic, into ${(ig.interests ?? []).slice(0, 3).join(' + ')}, ${sp?.vibeDescription || ig.musicVibe || ''} music taste`
    : `into ${(profile.interests ?? []).slice(0, 3).join(', ')}`;

  const g = precomputed?.graph ?? buildIdentityGraph(profile as Parameters<typeof buildIdentityGraph>[0]);
  const compactIdentity = precomputed?.summary || identitySummary(g);
  const hasLinkedIn = Boolean(g.role || g.industry);
  const hasMusicSignal = Boolean(g.topArtists?.length || g.topGenres?.length);
  const cardCount = hasLinkedIn && hasMusicSignal ? '6–8' : '4–6';

  const userContent = `Generate ${cardCount} hyper-personalised picks for: ${vibeDesc}

FULL IDENTITY CONTEXT (use every signal):
${compactIdentity}

Key signals to explicitly act on:
${g.role ? `- Professional: ${g.role}${g.company ? ` at ${g.company}` : ''}${g.industry ? `, ${g.industry}` : ''}${g.skills?.length ? ` — skills: ${g.skills.slice(0, 3).join(', ')}` : ''}` : ''}
${hasMusicSignal ? `- Music: ${[...g.topArtists.slice(0, 3), ...g.topGenres.slice(0, 2)].join(', ')}${g.musicVibe ? ` (${g.musicVibe})` : ''}` : ''}
${g.foodVibe ? `- Food taste: ${g.foodVibe}` : ''}
${g.aesthetic ? `- Style: ${g.aesthetic}` : ''}
${g.city ? `- Location: ${g.city}` : ''}

Required cards:
- 1 music discovery (concert, new release, or artist event matching their listening identity)
- 1 food or café experience matching their taste profile and city
- 1 nightlife or cultural event
- 1 fashion or wellness pick matching their aesthetic
${hasLinkedIn ? `- 1 professional pick: career event, industry tool, learning resource, or networking opportunity relevant to ${g.role || g.industry}` : ''}
${hasMusicSignal ? `- 1 additional pick that feels hyper-specific to this person's full signal set` : ''}

Search results:
${searchContext}

Call the tool emit_home_recommendations with ${cardCount} cards. Each description: 1 sentence max, written like you personally know them.
For any result tagged [EVENT LISTING]: extract event name, venue, and date into the title. Use the platform URL verbatim. Set price to the ticket price shown. Category = "nightlife" or "experience".`;

  const finish = (message: string, cards: ResultCard[]) => ({
    message,
    cards: attachResultThumbnails(cards, sourceResults ?? []),
  });

  const googleSub = precomputed?.googleSub?.trim() || null;

  try {
    if (googleSub) {
      const identityNote =
        '\n\nYou may call identity_search_semantic, identity_filter_structured, or identity_domain_summary to pull extra grounded claims about this user. When satisfied, call emit_home_recommendations once with the final cards (URLs from search results only).';

      const tools = [EMIT_HOME_RECS_TOOL, ...IDENTITY_MEMORY_TOOLS];
      let messages: MessageParam[] = [{ role: 'user', content: userContent }];

      for (let round = 0; round < 8; round++) {
        const tool_choice =
          round >= 6
            ? ({ type: 'tool', name: EMIT_HOME_RECS_TOOL.name } as const)
            : ({ type: 'auto' } as const);

        const toolResponse = await anthropic.messages.create({
          model: getAnthropicChatModel(),
          max_tokens: 1200,
          system: systemPrompt + identityNote,
          tools,
          tool_choice,
          messages,
        });

        const toolUses = toolResponse.content.filter((b): b is ToolUseBlock => b.type === 'tool_use');

        if (!toolUses.length) {
          const textBlock = toolResponse.content.find(b => b.type === 'text');
          const text = textBlock?.type === 'text' ? textBlock.text : '{}';
          const parsed = parseJsonResponse(text);
          let cards = sanitizeCardsToSearchResults(parsed.cards ?? [], sourceResults ?? []);
          if (!cards.length && (sourceResults?.length ?? 0) >= 2) {
            cards = buildFallbackCardsFromSearchResults(sourceResults ?? []).slice(0, 4);
          }
          return finish(parsed.message || 'Your picks for today', cards);
        }

        const emitUse = toolUses.find(t => t.name === EMIT_HOME_RECS_TOOL.name);
        if (emitUse) {
          const toolIn = emitUse.input as { message?: string; cards?: ResultCard[] };
          if (toolIn?.cards && Array.isArray(toolIn.cards) && toolIn.cards.length > 0) {
            let cards = sanitizeCardsToSearchResults(toolIn.cards, sourceResults ?? []);
            if (!cards.length && (sourceResults?.length ?? 0) >= 2) {
              cards = buildFallbackCardsFromSearchResults(sourceResults ?? []).slice(0, 4);
            }
            return finish(toolIn.message ?? 'Your picks for today', cards);
          }
        }

        messages.push({ role: 'assistant', content: toolResponse.content });
        const toolResults: ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          if (tu.name === EMIT_HOME_RECS_TOOL.name) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tu.id,
              content: JSON.stringify({
                ok: false,
                hint: 'emit_home_recommendations needs non-empty cards with URLs from the search results in the user message.',
              }),
            });
            continue;
          }
          const exec = await executeIdentityMemoryTool(
            tu.name,
            tu.input as Record<string, unknown>,
            googleSub,
          );
          toolResults.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: exec.content,
            ...(exec.isError ? { is_error: true } : {}),
          });
        }
        messages.push({ role: 'user', content: toolResults });
      }

      return { message: 'Your picks for today', cards: [] };
    }

    const toolResponse = await anthropic.messages.create({
      model: getAnthropicChatModel(),
      max_tokens: 1200,
      system: systemPrompt,
      tools: [EMIT_HOME_RECS_TOOL],
      tool_choice: { type: 'tool', name: EMIT_HOME_RECS_TOOL.name },
      messages: [{ role: 'user', content: userContent }],
    });

    const toolIn = extractToolUseInput<{ message?: string; cards?: ResultCard[] }>(
      toolResponse.content,
      EMIT_HOME_RECS_TOOL.name,
    );
    if (toolIn?.cards && Array.isArray(toolIn.cards) && toolIn.cards.length > 0) {
      let cards = sanitizeCardsToSearchResults(toolIn.cards, sourceResults ?? []);
      if (!cards.length && (sourceResults?.length ?? 0) >= 2) {
        cards = buildFallbackCardsFromSearchResults(sourceResults ?? []).slice(0, 4);
      }
      if (!cards.length) {
        console.error('generateHomeRecommendations: tool cards failed URL grounding. stop_reason:', toolResponse.stop_reason);
      }
      return finish(toolIn.message ?? 'Your picks for today', cards);
    }

    const textBlock = toolResponse.content.find(b => b.type === 'text');
    const text = textBlock?.type === 'text' ? textBlock.text : '{}';
    const parsed = parseJsonResponse(text);
    let cards = sanitizeCardsToSearchResults(parsed.cards, sourceResults ?? []);
    if (!cards.length && (sourceResults?.length ?? 0) >= 2) {
      cards = buildFallbackCardsFromSearchResults(sourceResults ?? []).slice(0, 4);
    }
    if (!cards.length) {
      console.error('generateHomeRecommendations: no cards. stop_reason:', toolResponse.stop_reason, 'Raw:', text.slice(0, 600));
    }
    return finish(parsed.message || 'Your picks for today', cards);
  } catch (e) {
    console.error('Claude recs error:', e);
    return { message: "Your picks for today", cards: [] };
  }
}

// ── Streaming chat (buffers full response, yields cards one-by-one) ────────

export type ChatStreamEvent =
  | { type: 'card'; card: ResultCard }
  | { type: 'message'; text: string }
  /** Incremental plain-text tokens before final JSON segment */
  | { type: 'text_delta'; delta: string }
  | {
      type: 'extras';
      suggested_followups?: string[];
      mood?: string;
      actions?: TwinChatAction[];
    };

const CHAT_JSON_DIVIDER = '|||JSON|||';

/** How Tier C (web vs profile-only) is framed for the model. */
export type ChatSearchTier = 'live_web' | 'profile_only' | 'probe';

function formatSearchTierSection(tier: ChatSearchTier, body: string): string {
  if (tier === 'live_web') {
    return `--- Tier C: Live web results (for links and freshness only; prefer identity match from Tier A) ---\n${body}`;
  }
  if (tier === 'profile_only') {
    return `--- Tier C: No live web search ---\nAnswer from Tier A signal pack, thread memory above, and the user message. Use cards: [] unless the user clearly asked for specific places, links, or things to buy.`;
  }
  return `--- Tier C: Greeting / probe mode ---\n${body}`;
}

export async function* streamChatResponse(
  message: string,
  searchContext: string,
  profile: {
    interests?: string[];
    budget?: string;
    social?: string;
    city?: string;
    instagramIdentity?: InstagramIdentity | null;
    spotifyIdentity?: { topArtists?: string[]; topGenres?: string[]; topTracks?: string[]; musicPersonality?: string; vibeDescription?: string } | null;
    appleMusicIdentity?: {
      topArtists?: string[];
      topGenres?: string[];
      musicPersonality?: string;
      vibeDescription?: string;
      rotationPlaylists?: string[];
      libraryPlaylists?: string[];
      latestReleases?: { artistName?: string; title?: string; releaseDate?: string }[];
    } | null;
    googleIdentity?: YouTubeLike | null;
    youtubeIdentity?: YouTubeLike | null;
    linkedinIdentity?: LinkedInLike | null;
  },
  sourceResults?: SearchResult[],
  opts?: {
    threadSummary?: string;
    intentHint?: string;
    browseIntent?: BrowseIntent;
    learnedMemory?: LearnedMemory;
    precomputed?: { graph?: IdentityGraph | null; summary?: string | null; googleSub?: string | null };
    /** Tier C labelling: live Brave results, profile-only, or probe greeting. */
    searchTier?: ChatSearchTier;
  },
): AsyncGenerator<ChatStreamEvent> {
  const systemPrompt = buildSystemPrompt(profile, opts?.learnedMemory, opts?.precomputed);
  const summaryBlock = opts?.threadSummary?.trim()
    ? `--- Tier B: Thread memory (compressed) ---\nPrior thread memory:\n${opts.threadSummary.trim()}\n\n`
    : '';
  const intentBlock = opts?.intentHint?.trim() ? `Intent hint: ${opts.intentHint}\n\n` : '';

  let contextPackBlock = '';
  try {
    if (opts?.precomputed?.googleSub?.trim()) {
      const pack = await buildContext(opts.precomputed.googleSub.trim(), message);
      contextPackBlock = formatCompressedContextForPrompt(pack);
    }
  } catch {
    /* ignore */
  }

  const systemAugmented = contextPackBlock
    ? `${systemPrompt}\n\n${CONTEXT_PACK_SYSTEM_ADDENDUM}`
    : systemPrompt;

  const graphForPack =
    opts?.precomputed?.graph ??
    buildIdentityGraph(profile as Parameters<typeof buildIdentityGraph>[0]);
  const summaryForPack = opts?.precomputed?.summary ?? identitySummary(graphForPack);
  const packMaxRaw = (privateEnv.CHAT_SIGNAL_PACK_MAX_CHARS ?? '').trim();
  const packMaxParsed = parseInt(packMaxRaw, 10);
  const packMax =
    Number.isFinite(packMaxParsed) && packMaxParsed >= 800 ? packMaxParsed : SIGNAL_PACK_MAX_CHARS_DEFAULT;
  const signalPack = formatSignalPackForChat(graphForPack, summaryForPack, packMax);

  const resultCount = sourceResults?.length ?? 0;
  const browseCardMode =
    Boolean(opts?.browseIntent) &&
    resultCount >= BROWSE_CARD_MIN_RESULTS &&
    !opts?.intentHint?.trim();

  const tier = opts?.searchTier ?? 'live_web';
  const tierCSection = formatSearchTierSection(tier, searchContext);

  const browseStrictBlock = browseCardMode
    ? `BROWSE MODE (${opts!.browseIntent}):
- Return 1–2 cards (your best picks). Each "url" MUST be copied verbatim from the Tier C live web lines below — no invented or guessed URLs.
- Do not return "cards": [] unless Tier C results are empty or wholly unusable.
- Your "message" is the main value: give a direct verdict on your top pick in 2–3 sentences. Cards support the message, not replace it.

`
    : '';

  const formatBlock = `
--- Output format (required) ---
1) Write your reply in plain text first (2–4 sentences, twin voice). No markdown fences around this part.
2) On its own line, exactly: ${CHAT_JSON_DIVIDER}
3) Then one JSON object with keys "message", "mood", "suggested_followups", "actions", "cards" exactly as in your instructions. The "message" string must match your plain text reply.`;

  const userContent = `${signalPack}

${summaryBlock}${intentBlock}${contextPackBlock}${browseStrictBlock}User message (includes recent conversation when present):\n${message}

${tierCSection}
${formatBlock}`;

  const systemWithFormat = `${systemAugmented}\n\nThe user message ends with "--- Output format ---". Obey it: plain text, then a line ${CHAT_JSON_DIVIDER}, then JSON.`;

  let buffer = '';
  let emittedPlain = 0;

  try {
    for await (const delta of streamChatLlmText({
      system: systemWithFormat,
      user: userContent,
    })) {
      buffer += delta;
      const div = buffer.indexOf(CHAT_JSON_DIVIDER);
      const plainEnd = div === -1 ? buffer.length : div;
      if (plainEnd > emittedPlain) {
        yield { type: 'text_delta', delta: buffer.slice(emittedPlain, plainEnd) };
        emittedPlain = plainEnd;
      }
    }
  } catch (e) {
    const prov = getChatLlmProvider();
    const msg = e instanceof Error ? e.message : String(e);
    const modelHint = prov === 'anthropic' ? getAnthropicChatModel() : prov;
    console.error(`[streamChatResponse] provider=${prov} model=${modelHint}`, msg);
    throw e;
  }

  const div = buffer.indexOf(CHAT_JSON_DIVIDER);
  const plainText = div === -1 ? '' : buffer.slice(0, div).trim();
  const jsonPart = div === -1 ? buffer.trim() : buffer.slice(div + CHAT_JSON_DIVIDER.length).trim();
  const parsed = parseJsonResponse(jsonPart || buffer);

  const finalMessage = plainText || parsed.message || '';

  let cardsOut = sanitizeCardsToSearchResults(parsed.cards ?? [], sourceResults ?? []);
  if (
    browseCardMode &&
    cardsOut.length === 0 &&
    sourceResults &&
    sourceResults.length >= BROWSE_CARD_MIN_RESULTS
  ) {
    console.warn('streamChatResponse: fallback cards from search results', {
      browseIntent: opts?.browseIntent,
      results: sourceResults.length,
    });
    cardsOut = buildFallbackCardsFromSearchResults(sourceResults);
  }

  if (!cardsOut.length && div !== -1) {
    console.error('streamChatResponse: no cards parsed. Raw json head:', jsonPart.slice(0, 400));
  }

  yield { type: 'message', text: finalMessage };

  const followups = Array.isArray(parsed.suggested_followups)
    ? parsed.suggested_followups.filter((s): s is string => typeof s === 'string').slice(0, 4)
    : undefined;
  const actions = Array.isArray(parsed.actions) ? (parsed.actions as TwinChatAction[]) : undefined;
  if ((followups?.length ?? 0) > 0 || parsed.mood || (actions?.length ?? 0) > 0) {
    yield {
      type: 'extras',
      suggested_followups: followups,
      mood: parsed.mood,
      actions,
    };
  }

  const cards = attachResultThumbnails(cardsOut, sourceResults ?? []);
  for (const card of cards) {
    yield { type: 'card', card };
  }
}

// ── JSON parser helper ─────────────────────────────────────────────────────

function parseJsonResponse(text: string): ChatResponse {
  // Strip markdown code fences if present
  const stripped = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
  const normalize = (parsed: ChatResponse): ChatResponse => ({
    message: parsed.message ?? '',
    cards: Array.isArray(parsed.cards) ? parsed.cards : [],
    suggested_followups: Array.isArray(parsed.suggested_followups)
      ? parsed.suggested_followups.filter((s): s is string => typeof s === 'string').slice(0, 4)
      : undefined,
    mood: parsed.mood,
    actions: Array.isArray(parsed.actions) ? (parsed.actions as TwinChatAction[]) : undefined,
  });
  try {
    const parsed = JSON.parse(stripped) as ChatResponse;
    return normalize(parsed);
  } catch {
    // Try extracting the first valid JSON object
    const match = stripped.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        const parsed = JSON.parse(match[0]) as ChatResponse;
        return normalize(parsed);
      } catch {}
    }
    return { message: stripped.slice(0, 200), cards: [] };
  }
}

export { categoryToGrad } from '$lib/utils';
