import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { streamChatResponse, type ChatSearchTier, type LearnedMemory } from '$lib/server/ai';
import {
  searchWeb,
  buildSearchQueries,
  formatResultsForAI,
  shouldRunWebSearch,
  type SearchResult,
} from '$lib/server/search';
import { resolveIdentityGraph } from '$lib/server/resolveGraph';
import { createApiTimer } from '$lib/server/apiTiming';

type HistoryEntry = {
  role: 'user' | 'ai';
  text: string;
  at?: string;
  cardRefs?: { title: string; url?: string }[];
};

/** Keep prompt latency predictable when threads are long (most recent wins). */
const MAX_HISTORY_CHARS = 12_000;

function capHistoryBlock(block: string): string {
  if (block.length <= MAX_HISTORY_CHARS) return block;
  const tail = block.slice(-MAX_HISTORY_CHARS);
  return `[Earlier conversation truncated for speed]\n${tail}`;
}

function formatHistoryBlock(recent: HistoryEntry[]): string {
  if (!recent.length) return '';
  const lines = recent.map(m => {
    const ts = m.at ? ` [${m.at}]` : '';
    let line = `${m.role === 'user' ? 'User' : 'Twin'}${ts}: ${m.text}`;
    if (m.role === 'ai' && m.cardRefs?.length) {
      const refs = m.cardRefs
        .filter(r => r.title || r.url)
        .slice(0, 6)
        .map(r => (r.url ? `"${r.title}" → ${r.url}` : `"${r.title}"`))
        .join('; ');
      if (refs) line += `\n  Result links from this twin reply: ${refs}`;
    }
    return line;
  });
  return (
    'Recent conversation (timestamps are ISO-8601 UTC; use them for "earlier", "last time", or follow-ups on past results):\n' +
    lines.join('\n\n') +
    '\n\nNow answer: '
  );
}

export const POST: RequestHandler = async ({ request }) => {
  const MAX_HISTORY_TURNS = 24;

  let body: {
    message: string;
    profile: Record<string, unknown>;
    googleSub?: string;
    history?: HistoryEntry[];
    threadSummary?: string;
    twinMemory?: LearnedMemory;
    isProbe?: boolean;
  };

  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const { message, profile } = body;
  if (!message?.trim()) throw error(400, 'message is required');

  const isProbe = body.isProbe === true;

  // Build history context block to prepend to the message (server-capped)
  const recent = (body.history ?? []).slice(-MAX_HISTORY_TURNS);
  const historyBlock = capHistoryBlock(formatHistoryBlock(recent));

  const threadSummary =
    typeof body.threadSummary === 'string' && body.threadSummary.trim().length > 2000
      ? body.threadSummary.trim().slice(0, 2000)
      : typeof body.threadSummary === 'string'
        ? body.threadSummary.trim()
        : '';

  // Light intent routing for model hint (search still runs unless we later skip)
  const msgLower = message.toLowerCase();
  let intentHint = '';
  if (/plan|itinerary|schedule|organize|organise|steps/i.test(message)) intentHint = 'planning';
  else if (/draft|write.*(email|message|text)|compose|reply to/i.test(message)) intentHint = 'drafting';
  else if (/summar|tl;dr|recap|what matters/i.test(message)) intentHint = 'summarise';
  else if (/remind|remember to|don\'t let me forget/i.test(message)) intentHint = 'remind';
  else if (/image|picture|photo|generate.*visual|poster/i.test(message)) intentHint = 'image';

  const encoder = new TextEncoder();

  function sse(event: string, data: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const timer = createApiTimer('/api/chat');
      let searchResultCount = 0;
      let searchContextChars = 0;
      let hadSearch = false;
      let firstTextDeltaMarked = false;
      try {
        controller.enqueue(sse('status', { text: 'Reading your profile…' }));
        timer.mark('firstEnqueue');

        const resolved = await resolveIdentityGraph(body.googleSub, profile);
        timer.mark('afterResolve');
        const profileArg = profile as Parameters<typeof buildSearchQueries>[1];
        const learnedHints = body.twinMemory ? {
          facts: body.twinMemory.facts,
          preferences: body.twinMemory.preferences,
          recentTopics: body.twinMemory.recentTopics,
        } : undefined;

        // Determine intent for status message and meta event
        const isEvent = /event|concert|gig|tonight|show|festival|experience|nightlife|party|happening|weekend plan|things to do|what.*on/i.test(message);
        const isMusic = /music|song|track|artist|playlist|album|release|listen|play/i.test(message);
        const isFood = /food|eat|restaurant|cafe|brunch|dinner|lunch|dine|hungry|where.*eat/i.test(message);

        const intent = isEvent ? 'event' : isMusic ? 'music' : isFood ? 'food' : 'general';

        const runSearch = !isProbe && shouldRunWebSearch(message, intentHint);

        const igCity =
          (profile.instagramIdentity as { city?: string } | null | undefined)?.city;
        const city = (profile.city as string | undefined) ?? igCity ?? 'Mumbai';

        let allResults: SearchResult[] = [];
        let allImages: string[] = [];
        let searchContext: string;
        let searchTier: ChatSearchTier;

        if (isProbe) {
          // Probe/greeting mode: no search needed (early status already sent)
          searchTier = 'probe';
          searchContext = '(Greeting mode — no web search. Introduce yourself as their digital twin, acknowledge what you know from their profile, and ask ONE natural question about a gap in your knowledge. No cards. Keep it to 2-3 warm sentences.)';
          searchContextChars = searchContext.length;
        } else if (!runSearch) {
          searchTier = 'profile_only';
          controller.enqueue(sse('status', { text: 'Thinking from your profile…' }));
          searchContext = '';
          searchContextChars = 0;
        } else {
          searchTier = 'live_web';
          const { queries, useEventDomains } = buildSearchQueries(message, profileArg, learnedHints, resolved.graph);
          const statusMsg = useEventDomains
            ? 'Searching BookMyShow, District, Urbanaut...'
            : isMusic
              ? 'Finding music for your taste...'
              : isFood
                ? 'Searching restaurants and cafes...'
                : 'Searching the web...';

          controller.enqueue(sse('status', { text: statusMsg }));

          try {
            let searchResponses;
            if (useEventDomains) {
              const [broadResponses, platformResponse] = await Promise.all([
                Promise.all(queries.slice(0, 2).map(q => searchWeb(q, 4))),
                searchWeb(`${message} ${city}`, 4, ['in.bookmyshow.com', 'district.in']),
              ]);
              searchResponses = [...broadResponses, platformResponse];
            } else {
              searchResponses = await Promise.all(queries.map(q => searchWeb(q, 4)));
            }

            const seenUrls = new Set<string>();
            allResults = searchResponses.flatMap(r => r.results).filter(r => {
              if (seenUrls.has(r.url)) return false;
              seenUrls.add(r.url);
              return true;
            });

            const seenImages = new Set<string>();
            allImages = searchResponses.flatMap(r => r.images).filter(img => {
              if (seenImages.has(img)) return false;
              seenImages.add(img);
              return true;
            });

            searchContext = formatResultsForAI(allResults, allImages, { maxResults: 6 });
            hadSearch = true;
            searchResultCount = allResults.length;
            searchContextChars = searchContext.length;
            timer.mark('afterSearch');
            controller.enqueue(sse('status', { text: 'Curating picks for you…' }));
          } catch (searchErr) {
            // Brave Search failed (quota, network, etc.) — fall back to profile-only
            console.error('[Chat] Web search failed, falling back to profile-only:', searchErr instanceof Error ? searchErr.message : searchErr);
            searchTier = 'profile_only';
            searchContext = '';
            searchContextChars = 0;
            controller.enqueue(sse('status', { text: 'Thinking from your profile…' }));
          }
        }

        controller.enqueue(sse('meta', { useEventDomains: false, intent }));

        // For probe mode, override the message with a greeting instruction
        const effectiveMessage = isProbe
          ? `[TWIN_GREETING] You are starting a fresh conversation with this user. Write a warm, personal opening message (2-3 sentences) that: (1) briefly acknowledges something specific you know about them from their profile, (2) asks ONE natural question about a gap — e.g. what music they've been into, what they like to eat, what they do on weekends, or any other aspect you don't know. Sound like a close friend catching up, not an assistant introducing itself.`
          : message;
        const fullMessage = historyBlock + effectiveMessage;

        const learnedMemory: LearnedMemory | undefined = body.twinMemory ?? undefined;

        for await (const event of streamChatResponse(
          fullMessage,
          searchContext,
          profile as Parameters<typeof streamChatResponse>[2],
          allResults,
          {
            threadSummary: threadSummary || undefined,
            intentHint: intentHint || undefined,
            browseIntent: intent,
            learnedMemory,
            searchTier,
            precomputed: {
              graph: resolved.graph,
              summary: resolved.summary,
              googleSub: body.googleSub,
            },
          },
        )) {
          if (event.type === 'card') {
            controller.enqueue(sse('card', event.card));
          } else if (event.type === 'text_delta') {
            if (!firstTextDeltaMarked) {
              timer.mark('firstTextDelta');
              firstTextDeltaMarked = true;
            }
            controller.enqueue(sse('text_delta', { delta: event.delta }));
          } else if (event.type === 'message') {
            controller.enqueue(sse('message', { text: event.text }));
          } else if (event.type === 'extras') {
            controller.enqueue(
              sse('extras', {
                suggested_followups: event.suggested_followups,
                mood: event.mood,
                actions: event.actions,
              }),
            );
          }
        }
        timer.mark('afterStream');
      } catch (e) {
        const detail = e instanceof Error ? e.message : String(e);
        console.error('Chat stream error:', detail, e);
        controller.enqueue(sse('error', { text: 'Something went wrong — please try again.' }));
      } finally {
        timer.finish({
          hadSearch,
          searchResultCount,
          searchContextChars,
        });
        controller.enqueue(sse('done', {}));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
};
