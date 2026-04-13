<script lang="ts">
  import { onMount, onDestroy, afterUpdate, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { profile } from '$lib/stores/profile';
  import { reminders } from '$lib/stores/reminders';
  import type { ResultCard as Card } from '$lib/utils';
  import type { CalendarEvent } from '$lib/server/google';
  import PersonaBg from '$lib/components/PersonaBg.svelte';
  import ShareCardModal from '$lib/components/ShareCardModal.svelte';
  import HeroIdentity from '$lib/components/home/HeroIdentity.svelte';
  import InsightCarousel from '$lib/components/home/InsightCarousel.svelte';
  import ForYouTabs from '$lib/components/home/ForYouTabs.svelte';
  import QuickAskBar from '$lib/components/home/QuickAskBar.svelte';
  import type { IdentitySnapshotWrapper } from '$lib/types/identitySnapshot';
  import type { IdentityIntelligenceWrapper } from '$lib/types/identityIntelligence';
  import type { IdentitySynthesisWrapper } from '$lib/types/identitySynthesis';
  import type { IdentityMusicContext } from '$lib/types/identityMusicContext';
  import type { InferenceIdentityWrapper, InferenceLifeDomainId } from '$lib/types/inferenceIdentity';
  import { getSpeechRecognition, isSpeechRecognitionSupported } from '$lib/voice/speech';
  import Lightning from 'phosphor-svelte/lib/Lightning';
  import Scales from 'phosphor-svelte/lib/Scales';
  import TrendUp from 'phosphor-svelte/lib/TrendUp';
  import { twinUiContext, updateTwinContextFromCalendar, startTwinContextClock } from '$lib/stores/contextStore';
  import { ensureMatchReasons } from '$lib/utils/matchReason';
  import {
    loadTwinMemory,
    saveTwinMemory,
    mergeLearnings,
    shouldLearn,
    memoryKeyForProfile as twinMemKeyForProfile,
    type TwinMemoryState,
  } from '$lib/stores/twinMemory';
  import {
    loadChatMemory,
    saveChatMemory,
    memoryKeyForProfile,
    shouldRollSummary,
    SUMMARY_EVERY_USER_TURNS,
    toCardRefs,
    cardRefsToCards,
    pickNewerThread,
    type ChatMemoryState,
  } from '$lib/stores/chatMemory';
  import {
    loadHomePersonaFromSession,
    saveHomePersonaToSession,
    type HomePersonaSessionPayload,
    type HomePersonaSignalHighlight as HomeSignalHighlight,
    type HomePersonaSignalCluster as HomeSignalCluster,
    type HomePersonaInferenceCompact as InferenceCompact,
    type HomePersonaHyperInferenceCompact as HyperInferenceCompact,
  } from '$lib/stores/homePersonaSessionCache';
  import { getCurrentContext } from '$lib/stores/contextStore';
  import { ensureMatchReason } from '$lib/utils/matchReason';

  // ── Time ──────────────────────────────────────────────────────────────────
  const DATE_STR = new Date().toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'short' });

  // ── Profile-derived ────────────────────────────────────────────────────────
  let firstName = '';
  $: {
    const n = $profile.name;
    firstName = n.startsWith('@') ? n : (n.split(' ')[0] || 'there');
  }
  $: city = $profile.city || $profile.instagramIdentity?.city || '';

  $: identityMusicContext = ((): IdentityMusicContext => {
    const am = $profile.appleMusicIdentity;
    const sp = $profile.spotifyIdentity;
    const topArtists =
      (am?.topArtists?.length ?? 0) > 0 ? (am?.topArtists ?? []) : (sp?.topArtists ?? []);
    return {
      topArtists,
      topAlbums: am?.topAlbums ?? [],
      latestReleases: am?.latestReleases ?? [],
    };
  })();

  // Identity completeness score
  $: completeness = (() => {
    let s = 0;
    if ($profile.name && $profile.city) s += 10;
    if ($profile.interests?.length >= 3) s += 10;
    if ($profile.instagramConnected) s += 20;
    if ($profile.spotifyConnected || $profile.appleMusicConnected) s += 20;
    if ($profile.googleConnected || $profile.youtubeConnected) s += 20;
    if ($profile.linkedinConnected) s += 20;
    return Math.min(s, 100);
  })();

  // ── PA input ──────────────────────────────────────────────────────────────
  let paQuery = '';
  let paInputEl: HTMLTextAreaElement;

  let homeListening = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let homeRec: any = null;

  function stopListeningHome() {
    try {
      homeRec?.stop();
    } catch {
      /* ignore */
    }
    homeRec = null;
    homeListening = false;
  }

  async function toggleListenHome() {
    const Ctor = getSpeechRecognition();
    if (!Ctor) return;
    if (homeListening) {
      stopListeningHome();
      return;
    }
    homeListening = true;
    const r = new Ctor();
    r.continuous = false;
    r.interimResults = true;
    r.lang = 'en-IN';
    r.onresult = (e: unknown) => {
      const ev = e as { results?: ArrayLike<{ 0?: { transcript?: string } }> };
      const t = ev.results?.[0]?.[0]?.transcript ?? '';
      if (t) paQuery = t;
    };
    r.onerror = () => {
      stopListeningHome();
    };
    r.onend = () => {
      stopListeningHome();
    };
    homeRec = r;
    try {
      r.start();
    } catch {
      stopListeningHome();
    }
  }

  type HomeChatMessage = {
    role: 'user' | 'ai';
    text: string;
    loading?: boolean;
    error?: boolean;
    at?: string;
    cards?: Card[];
  };

  let chatBusy = false;
  let homeChatStatus = '';
  let homeChatMode: 'learn' | 'ask' = 'ask';
  let homeChatMessages: HomeChatMessage[] = [];
  let memoryKey = '';
  let threadSummary = '';
  let userTurnsSinceSummary = 0;
  let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;
  let twinMemKey = '';
  let twinMem: TwinMemoryState = {
    version: 1,
    facts: [],
    preferences: {},
    recentTopics: [],
    identityOverrides: [],
    learnedAt: '',
  };
  let homeChatScrollEl: HTMLDivElement;
  const HOME_PROMPT_ROTATION = [
    'What am I optimizing for right now?',
    'How do I come across online?',
    'What should I double down on?',
  ] as const;
  let homePromptIndex = 0;
  let homePromptTimer: ReturnType<typeof setInterval> | null = null;
  const HOME_PROMPTS_LEARN = [
    'What are you optimizing this week?',
    'What feels off lately?',
    ...HOME_PROMPT_ROTATION,
  ];
  let homeQuestionPrompt = HOME_PROMPTS_LEARN[0];
  const COMPOSER_PLACEHOLDER_ASK = 'Tell me something I should understand about you…';
  const COMPOSER_PLACEHOLDER_LEARN = 'Share a detail that should update how we read you…';
  $: composerPlaceholder =
    homeChatMode === 'learn' ? COMPOSER_PLACEHOLDER_LEARN : COMPOSER_PLACEHOLDER_ASK;

  /** Subcopy under “Ask your system” — rotates in Teach portrait mode only via `homeQuestionPrompt`. */
  $: chatColumnSubtitle =
    homeChatMode === 'learn'
      ? homeQuestionPrompt
      : 'Grounded in your identity graph and stored inference — ask anything.';

  function buildCurrentReadLines(ic: InferenceCompact | null): string[] {
    if (!ic) return [];
    const raw: string[] = [];
    if (ic.predictive_one_liner?.trim()) raw.push(ic.predictive_one_liner.trim());
    if (ic.intent_primary?.trim()) raw.push(ic.intent_primary.trim());
    const blob = raw.join(' ');
    const sentences = blob
      .split(/(?<=[.!?])\s+/)
      .map(s => s.trim())
      .filter(Boolean);
    if (sentences.length) return sentences.slice(0, 3);
    if (raw.length) return raw.slice(0, 2);
    if (ic.life_domains_top?.length) {
      return [ic.life_domains_top.map(d => d.label).slice(0, 4).join(' · ')];
    }
    return [];
  }

  let personaSignalHighlights: HomeSignalHighlight[] = [];
  let personaSignalClusters: HomeSignalCluster[] = [];
  let personaSignalDominantPatterns: string[] = [];
  let inferenceCompact: InferenceCompact | null = null;
  let personaHyperCompact: HyperInferenceCompact | null = null;
  $: currentReadLines = buildCurrentReadLines(inferenceCompact);

  function parseContrastLines(core: string): [string, string][] {
    const separators = [' ↔ ', ' vs ', ' but ', ' — '];
    for (const sep of separators) {
      if (core.includes(sep)) {
        const [a, b] = core.split(sep);
        return [[a.trim(), b.trim()]];
      }
    }
    return [[core.trim(), '']];
  }

  $: hasHowAcrossBlock =
    !!personaSnapshot &&
    (!!personaSnapshot.payload.core_contradiction?.trim() ||
      !!personaSnapshot.payload.social_identity?.how_people_see_you?.trim() ||
      !!personaSnapshot.payload.social_identity?.actual_you?.trim() ||
      personaSignalClusters.length > 0);

  $: instagramAnchor = (() => {
    const ig = $profile.instagramIdentity;
    if (!ig?.username) return '';
    const followers = typeof ig.followersCount === 'number' ? ` · ${ig.followersCount.toLocaleString()} followers` : '';
    return `@${ig.username}${followers}`;
  })();
  $: musicAnchor = (() => {
    if ($profile.spotifyIdentity?.topGenres?.length) return $profile.spotifyIdentity.topGenres[0];
    if ($profile.spotifyIdentity?.topArtists?.length) return $profile.spotifyIdentity.topArtists[0];
    if ($profile.appleMusicIdentity?.topGenres?.length) return $profile.appleMusicIdentity.topGenres[0];
    if ($profile.appleMusicIdentity?.topArtists?.length) return $profile.appleMusicIdentity.topArtists[0];
    return '';
  })();
  $: linkedinAnchor = (() => {
    const headline = $profile.linkedinIdentity?.headline?.trim();
    return headline ? headline.slice(0, 52) + (headline.length > 52 ? '…' : '') : '';
  })();

  function snipSignalRead(s: string, max = 118): string {
    const t = s.replace(/\s+/g, ' ').trim();
    if (!t) return '';
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
  }

  function clusterHintFor(clusters: HomeSignalCluster[], keywords: string[]): string {
    const kw = keywords.map(k => k.toLowerCase());
    const c = clusters.find(
      cl =>
        kw.some(k => cl.theme.toLowerCase().includes(k)) ||
        (cl.signals?.length &&
          cl.signals.some(sig => kw.some(k => sig.toLowerCase().includes(k)))),
    );
    if (!c) return '';
    if (c.signals?.length) return snipSignalRead(`${c.theme} — ${c.signals[0]}`, 130);
    return snipSignalRead(c.theme, 130);
  }

  function domainNarrative(
    inference: InferenceIdentityWrapper | null,
    id: InferenceLifeDomainId,
  ): string {
    return snipSignalRead(inference?.current?.life_domains?.find(d => d.id === id)?.narrative ?? '');
  }

  $: interpretedSignals = (() => {
    const igN = domainNarrative(personaInference, 'social_creator');
    const musicN = domainNarrative(personaInference, 'music');
    const careerN = domainNarrative(personaInference, 'career_work');
    const topGenre =
      $profile.spotifyIdentity?.topGenres?.[0] || $profile.appleMusicIdentity?.topGenres?.[0] || '';

    let igRead = igN || clusterHintFor(personaSignalClusters, ['instagram', 'visual', 'creator', 'photo', 'social']);
    if (!igRead && inferenceCompact?.predictive_one_liner?.trim()) {
      igRead = snipSignalRead(inferenceCompact.predictive_one_liner);
    }
    if (!igRead) {
      igRead = $profile.instagramIdentity?.username
        ? 'You lean visual, minimal, and intentional.'
        : 'Your visual voice is still under-sampled.';
    }

    let musicRead = musicN || clusterHintFor(personaSignalClusters, ['music', 'taste', 'listen', 'audio', 'sound']);
    if (!musicRead && inferenceCompact?.intent_primary?.trim()) {
      musicRead = snipSignalRead(inferenceCompact.intent_primary);
    }
    if (!musicRead) {
      musicRead = topGenre
        ? `Preference: ${topGenre}, introspective tones.`
        : 'Your listening identity is still emerging.';
    }

    let liRead = careerN || clusterHintFor(personaSignalClusters, ['career', 'work', 'professional', 'linkedin']);
    if (!liRead) {
      liRead = $profile.linkedinIdentity?.headline
        ? 'Professional identity is under-expressed vs your creative side.'
        : 'Your professional narrative has low visible signal.';
    }

    return [
      {
        source: 'Instagram' as const,
        read: igRead,
        anchor: instagramAnchor,
        confidence: Math.min(
          1,
          Number(personaSignalHighlights.find(s => s.category.toLowerCase().includes('instagram'))?.final_score ?? 0.45),
        ),
      },
      {
        source: 'Music' as const,
        read: musicRead,
        anchor: musicAnchor,
        confidence: Math.min(1, Number(personaSignalHighlights.find(s => s.type === 'taste')?.final_score ?? 0.52)),
      },
      {
        source: 'LinkedIn' as const,
        read: liRead,
        anchor: linkedinAnchor,
        confidence: Math.min(
          1,
          Number(personaSignalHighlights.find(s => s.category.toLowerCase().includes('linkedin'))?.final_score ?? 0.49),
        ),
      },
    ];
  })();

  /** Short note under Signals when graph inference exists */
  $: inferenceMetaLine = (() => {
    const iso = personaInference?.inferredAt?.trim();
    if (!iso) return '';
    const d = Date.parse(iso);
    if (!Number.isFinite(d)) return '';
    return `Inference graph · ${new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
  })();

  $: googleInferenceLine = snipSignalRead(
    personaInference?.current?.predictive_read?.you_in_one_line?.trim() ||
      inferenceCompact?.predictive_one_liner?.trim() ||
      '',
    200,
  );

  $: showGoogleInferenceHint =
    Boolean(googleInferenceLine) &&
    googleInferenceLine.trim().toLowerCase() !== twinInsightLine.trim().toLowerCase();

  function prepareHomeQuestion() {
    const mode = personaIntelligence?.payload.snapshot.mode ?? '';
    if (mode === 'executing') {
      homeQuestionPrompt = 'What are you pushing hardest this week that you want people to notice more clearly?';
      return;
    }
    if (mode === 'building') {
      homeQuestionPrompt = 'What are you building that feels most like you right now?';
      return;
    }
    if (mode === 'exploring') {
      homeQuestionPrompt = 'What are you circling right now that you have not committed to yet?';
      return;
    }
    if (!$profile.linkedinConnected) {
      homeQuestionPrompt = 'How do you want people to describe your work in one line?';
      return;
    }
    if (!$profile.spotifyConnected && !$profile.appleMusicConnected) {
      homeQuestionPrompt = 'What have you been listening to lately that says something about where your head is at?';
      return;
    }
    homeQuestionPrompt = 'What is one thing you wish this app understood about you better?';
  }

  async function scrollHomeChatToBottom() {
    await tick();
    if (homeChatScrollEl) {
      homeChatScrollEl.scrollTop = homeChatScrollEl.scrollHeight;
    }
  }

  function scheduleCloudThreadSync() {
    if (!$profile.googleSub || typeof window === 'undefined' || !memoryKey) return;
    if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(async () => {
      cloudSyncTimer = null;
      const state = loadChatMemory(memoryKey);
      try {
        await fetch('/api/chat/thread', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ googleSub: $profile.googleSub, thread: state }),
        });
      } catch {
        /* ignore */
      }
    }, 900);
  }

  function persistHomeThread() {
    if (!memoryKey || typeof window === 'undefined') return;
    const stored: ChatMemoryState['messages'] = homeChatMessages
      .filter(m => !m.loading && !m.error)
      .map(m => ({
        role: m.role,
        text: m.text,
        ...(m.at ? { at: m.at } : {}),
        ...(m.role === 'ai' && m.cards?.length ? { cardRefs: toCardRefs(m.cards) } : {}),
      }));
    saveChatMemory(memoryKey, {
      version: 2,
      updatedAt: new Date().toISOString(),
      messages: stored,
      summary: threadSummary || undefined,
    });
    scheduleCloudThreadSync();
  }

  async function maybeRollHomeSummary(prevUserCount: number, newUserCount: number) {
    if (!shouldRollSummary(prevUserCount, newUserCount)) return;
    const payload = homeChatMessages
      .filter(m => !m.loading && !m.error)
      .map(m => ({ role: m.role, text: m.text }));
    try {
      const res = await fetch('/api/chat/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payload }),
      });
      if (res.ok) {
        const data = await res.json();
        threadSummary = String(data.summary ?? '').slice(0, 1200);
        userTurnsSinceSummary = 0;
        persistHomeThread();
      }
    } catch {
      /* ignore */
    }
  }

  async function maybeLearnFromHomeChat(prevUserCount: number, newUserCount: number) {
    if (!shouldLearn(prevUserCount, newUserCount)) return;
    const payload = homeChatMessages
      .filter(m => !m.loading && !m.error && m.text)
      .slice(-16)
      .map(m => ({ role: m.role, text: m.text }));
    if (payload.length < 2) return;
    try {
      const res = await fetch('/api/chat/learn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: payload,
          existingFacts: twinMem.facts,
          existingPreferences: twinMem.preferences,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        twinMem = mergeLearnings(twinMem, data);
        saveTwinMemory(twinMemKey, twinMem);
      }
    } catch {
      /* ignore */
    }
  }

  async function submitPA() {
    const q = paQuery.trim();
    if (!q || chatBusy) return;
    const sub = $profile.googleSub?.trim();
    if (!sub) return;

    const prevUserCount = homeChatMessages.filter(m => m.role === 'user').length;
    const userAt = new Date().toISOString();
    const userMsg: HomeChatMessage = { role: 'user', text: q, at: userAt };
    homeChatMessages = [...homeChatMessages, userMsg];
    paQuery = '';
    chatBusy = true;
    void scrollHomeChatToBottom();

    if (homeChatMode === 'learn') {
      homeChatStatus = 'updating your portrait';
      const aiMsg: HomeChatMessage = {
        role: 'ai',
        text: 'Got it. Folding that into how I read you now.',
        loading: true,
      };
      homeChatMessages = [...homeChatMessages, aiMsg];
      try {
        const res = await fetch('/api/user/identity-intelligence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            googleSub: sub,
            userQuery: `Q: ${homeQuestionPrompt} A: ${q}`,
          }),
        });
        const doneAt = new Date().toISOString();
        if (res.ok) {
          await loadPersona();
          prepareHomeQuestion();
          homeChatMessages = [
            ...homeChatMessages.slice(0, -1),
            { role: 'ai', text: 'Got it. Your portrait is sharper now — keep going.', at: doneAt },
          ];
        } else {
          homeChatMessages = [
            ...homeChatMessages.slice(0, -1),
            { role: 'ai', text: 'I could not update that right now. Try again in a sec.', at: doneAt },
          ];
        }
      } catch {
        const doneAt = new Date().toISOString();
        homeChatMessages = [
          ...homeChatMessages.slice(0, -1),
          { role: 'ai', text: 'I hit a network issue. Try again in a sec.', at: doneAt },
        ];
      } finally {
        homeChatStatus = '';
        chatBusy = false;
        void scrollHomeChatToBottom();
        persistHomeThread();
        const newUserCount = homeChatMessages.filter(m => m.role === 'user').length;
        void maybeRollHomeSummary(prevUserCount, newUserCount);
      }
      return;
    }

    twinMemKey = twinMemKeyForProfile($profile);
    twinMem = loadTwinMemory(twinMemKey);
    const twinMemPayload =
      twinMem.facts.length ||
      Object.keys(twinMem.preferences).length ||
      (twinMem.identityOverrides?.length ?? 0)
        ? {
            facts: twinMem.facts,
            preferences: twinMem.preferences,
            recentTopics: twinMem.recentTopics,
            identityOverrides: twinMem.identityOverrides,
          }
        : undefined;

    const historyPayload = homeChatMessages
      .filter(m => !m.loading && !m.error && m.text)
      .slice(-24)
      .map(m => ({
        role: m.role,
        text: m.text,
        ...(m.at ? { at: m.at } : {}),
        ...(m.role === 'ai' && m.cards?.length ? { cardRefs: toCardRefs(m.cards) } : {}),
      }));

    let aiMsg: HomeChatMessage = { role: 'ai', text: '', cards: [], loading: true };
    homeChatMessages = [...homeChatMessages, aiMsg];
    homeChatStatus = 'thinking';
    void scrollHomeChatToBottom();

    let streamTextBuf = '';
    let streamFlushRaf = 0;
    function queueStreamDelta(d: string) {
      if (!d) return;
      streamTextBuf += d;
      if (streamFlushRaf) return;
      streamFlushRaf = requestAnimationFrame(() => {
        streamFlushRaf = 0;
        const chunk = streamTextBuf;
        streamTextBuf = '';
        if (!chunk) return;
        aiMsg = { ...aiMsg, text: (aiMsg.text || '') + chunk, loading: true };
        homeChatMessages = [...homeChatMessages.slice(0, -1), aiMsg];
        void scrollHomeChatToBottom();
      });
    }
    function flushStreamPending() {
      if (streamFlushRaf) {
        cancelAnimationFrame(streamFlushRaf);
        streamFlushRaf = 0;
      }
      if (streamTextBuf) {
        aiMsg = { ...aiMsg, text: (aiMsg.text || '') + streamTextBuf, loading: aiMsg.loading };
        streamTextBuf = '';
        homeChatMessages = [...homeChatMessages.slice(0, -1), aiMsg];
      }
    }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          profile: $profile,
          googleSub: sub,
          history: historyPayload,
          threadSummary: threadSummary || undefined,
          twinMemory: twinMemPayload,
        }),
      });
      if (!res.ok || !res.body) throw new Error('chat_failed');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split('\n\n');
        buf = parts.pop() ?? '';

        for (const part of parts) {
          let eventType = 'message';
          let dataStr = '';
          for (const line of part.trim().split('\n')) {
            if (line.startsWith('event: ')) eventType = line.slice(7).trim();
            if (line.startsWith('data: ')) dataStr = line.slice(6);
          }
          if (!dataStr) continue;
          try {
            const payload = JSON.parse(dataStr) as Record<string, unknown>;
            if (eventType === 'status') {
              homeChatStatus = (payload.text as string) ?? 'thinking';
            } else if (eventType === 'card') {
              const card = ensureMatchReason(
                payload as unknown as Card,
                $profile.googleIdentity?.twin,
                getCurrentContext(),
              );
              aiMsg = { ...aiMsg, loading: false, cards: [...(aiMsg.cards ?? []), card] };
              homeChatMessages = [...homeChatMessages.slice(0, -1), aiMsg];
              void scrollHomeChatToBottom();
            } else if (eventType === 'text_delta') {
              queueStreamDelta(typeof payload.delta === 'string' ? payload.delta : '');
            } else if (eventType === 'message') {
              flushStreamPending();
              aiMsg = {
                ...aiMsg,
                text: (payload.text as string) ?? aiMsg.text,
                loading: false,
              };
              homeChatMessages = [...homeChatMessages.slice(0, -1), aiMsg];
              void scrollHomeChatToBottom();
            } else if (eventType === 'done') {
              flushStreamPending();
              const doneAt = new Date().toISOString();
              aiMsg = { ...aiMsg, loading: false, at: aiMsg.at ?? doneAt };
              homeChatMessages = [...homeChatMessages.slice(0, -1), aiMsg];
            } else if (eventType === 'error') {
              flushStreamPending();
              const errAt = new Date().toISOString();
              aiMsg = {
                role: 'ai',
                text: typeof payload.text === 'string' ? payload.text : 'Something went wrong.',
                cards: [],
                loading: false,
                error: true,
                at: errAt,
              };
              homeChatMessages = [...homeChatMessages.slice(0, -1), aiMsg];
            }
          } catch {
            /* ignore parse */
          }
        }
      }
    } catch {
      flushStreamPending();
      const errAt = new Date().toISOString();
      homeChatMessages = [
        ...homeChatMessages.slice(0, -1),
        { role: 'ai', text: 'I could not answer that cleanly right now. Try again.', loading: false, at: errAt },
      ];
    } finally {
      flushStreamPending();
      homeChatStatus = '';
      chatBusy = false;
      let last = homeChatMessages[homeChatMessages.length - 1];
      if (last?.role === 'ai' && last.loading) {
        homeChatMessages = [
          ...homeChatMessages.slice(0, -1),
          { ...last, loading: false, text: last.text || '…', at: last.at ?? new Date().toISOString() },
        ];
        last = homeChatMessages[homeChatMessages.length - 1];
      }
      if (last?.role === 'ai' && !last.loading && !last.at) {
        homeChatMessages = [
          ...homeChatMessages.slice(0, -1),
          { ...last, at: new Date().toISOString() },
        ];
      }
      void scrollHomeChatToBottom();
      persistHomeThread();
      const newUserCount = homeChatMessages.filter(m => m.role === 'user').length;
      void maybeRollHomeSummary(prevUserCount, newUserCount);
      void maybeLearnFromHomeChat(prevUserCount, newUserCount);
    }
  }
  function handlePAKey(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitPA();
    }
  }

  function autoResizeHomePA() {
    if (!paInputEl) return;
    paInputEl.style.height = 'auto';
    paInputEl.style.height = Math.min(paInputEl.scrollHeight, 120) + 'px';
  }

  onDestroy(() => {
    stopListeningHome();
  });

  // ── Persona state ─────────────────────────────────────────────────────────
  let personaLoading = true;
  let personaSnapshot: IdentitySnapshotWrapper | null = null;
  let personaIntelligence: IdentityIntelligenceWrapper | null = null;
  let personaRegenerating = false;
  let showShareModal = false;

  /** Trimmed inference graph for Earn-style panel on Home. */
  let personaInference: InferenceIdentityWrapper | null = null;

  /** Premium identity mirror (LLM synthesis). */
  let personaIdentitySynthesis: IdentitySynthesisWrapper | null = null;

  $: currentReadConfidence = personaIntelligence?.payload?.snapshot?.confidence ?? null;

  $: photoUrl = ($profile.instagramIdentity as { profilePicture?: string } | null | undefined)?.profilePicture ?? null;

  /** True when we can render the top banner without waiting on identitySnapshot alone (avoids skeleton when graph has intel/inference but snapshot parse fails). */
  $: hasHomeHeaderContent =
    !!personaSnapshot ||
    !!personaIntelligence?.payload?.snapshot ||
    !!(inferenceCompact?.predictive_one_liner?.trim()) ||
    !!(personaInference?.current?.predictive_read?.you_in_one_line?.trim());

  $: headerFallbackOneLiner =
    inferenceCompact?.predictive_one_liner?.trim() ||
    personaInference?.current?.predictive_read?.you_in_one_line?.trim() ||
    '';

  function applyHomePersonaPayload(p: HomePersonaSessionPayload) {
    personaIdentitySynthesis = p.identitySynthesis ?? null;
    personaSnapshot = p.identitySnapshot ?? null;
    personaIntelligence = p.identityIntelligence ?? null;
    personaSignalHighlights = p.signalHighlights ?? [];
    personaSignalClusters = p.signalClusters ?? [];
    personaSignalDominantPatterns = p.signalDominantPatterns ?? [];
    inferenceCompact = p.inferenceCompact ?? null;
    personaInference = p.inference ?? null;
    personaHyperCompact = p.hyperInferenceCompact ?? null;
    prepareHomeQuestion();
  }

  function saveCurrentPersonaToSession(sub: string) {
    saveHomePersonaToSession(sub, {
      identitySynthesis: personaIdentitySynthesis,
      identitySnapshot: personaSnapshot,
      identityIntelligence: personaIntelligence,
      signalHighlights: personaSignalHighlights,
      signalClusters: personaSignalClusters,
      signalDominantPatterns: personaSignalDominantPatterns,
      inferenceCompact,
      inference: personaInference,
      hyperInferenceCompact: personaHyperCompact,
    });
  }

  async function loadPersona() {
    const sub = $profile.googleSub?.trim();
    if (!sub) {
      personaLoading = false;
      return;
    }
    const alreadyHasHeaderSurface =
      !!personaSnapshot ||
      !!personaIntelligence?.payload?.snapshot ||
      !!(inferenceCompact?.predictive_one_liner?.trim()) ||
      !!(personaInference?.current?.predictive_read?.you_in_one_line?.trim());
    if (!alreadyHasHeaderSurface) {
      personaLoading = true;
    }
    try {
      const res = await fetch(`/api/user/persona?sub=${encodeURIComponent(sub)}`);
      const j = await res.json().catch(() => ({}));
      if (res.ok && (j as { ok?: boolean }).ok) {
        personaIdentitySynthesis =
          (j as { identitySynthesis?: IdentitySynthesisWrapper | null }).identitySynthesis ?? null;
        personaSnapshot = (j as { identitySnapshot?: IdentitySnapshotWrapper | null }).identitySnapshot ?? null;
        personaIntelligence = (j as { identityIntelligence?: IdentityIntelligenceWrapper | null }).identityIntelligence ?? null;
        personaSignalHighlights = (j as { signalHighlights?: HomeSignalHighlight[] }).signalHighlights ?? [];
        personaSignalClusters = (j as { signalClusters?: HomeSignalCluster[] }).signalClusters ?? [];
        personaSignalDominantPatterns =
          (j as { signalDominantPatterns?: string[] }).signalDominantPatterns ?? [];
        inferenceCompact = (j as { inferenceCompact?: InferenceCompact | null }).inferenceCompact ?? null;
        personaInference = (j as { inference?: InferenceIdentityWrapper | null }).inference ?? null;
        personaHyperCompact =
          (j as { hyperInferenceCompact?: HyperInferenceCompact | null }).hyperInferenceCompact ?? null;
        prepareHomeQuestion();
        saveCurrentPersonaToSession(sub);
      }
    } catch {
      /* non-fatal */
    }
    personaLoading = false;
  }

  async function regeneratePersona() {
    const sub = $profile.googleSub?.trim();
    if (!sub || personaRegenerating) return;
    personaRegenerating = true;
    try {
      const res = await fetch('/api/user/persona', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleSub: sub, force: true }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && (j as { ok?: boolean }).ok) {
        personaIdentitySynthesis =
          (j as { identitySynthesis?: IdentitySynthesisWrapper | null }).identitySynthesis ?? null;
        personaSnapshot = (j as { identitySnapshot?: IdentitySnapshotWrapper | null }).identitySnapshot ?? null;
        personaIntelligence = (j as { identityIntelligence?: IdentityIntelligenceWrapper | null }).identityIntelligence ?? null;
        personaSignalHighlights = (j as { signalHighlights?: HomeSignalHighlight[] }).signalHighlights ?? [];
        personaSignalClusters = (j as { signalClusters?: HomeSignalCluster[] }).signalClusters ?? [];
        personaSignalDominantPatterns =
          (j as { signalDominantPatterns?: string[] }).signalDominantPatterns ?? [];
        inferenceCompact = (j as { inferenceCompact?: InferenceCompact | null }).inferenceCompact ?? null;
        personaInference = (j as { inference?: InferenceIdentityWrapper | null }).inference ?? null;
        personaHyperCompact =
          (j as { hyperInferenceCompact?: HyperInferenceCompact | null }).hyperInferenceCompact ?? null;
        prepareHomeQuestion();
        saveCurrentPersonaToSession(sub);
      }
    } catch {
      /* non-fatal */
    }
    personaRegenerating = false;
  }

  async function ensureHomeContextLoadedAndScroll() {
    ensureHomeContextLoaded();
    await tick();
    document.getElementById('home-more-context')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function ensureHomeContextLoaded() {
    if (!$profile.setupComplete) return;
    const hasAnyPlatform = $profile.instagramConnected || $profile.spotifyConnected ||
      $profile.appleMusicConnected || $profile.googleConnected || $profile.youtubeConnected ||
      $profile.linkedinConnected;
    if (hasAnyPlatform || ($profile.interests?.length ?? 0) > 0) {
      loadHomeFeed();
    } else {
      recsLoading = false;
      newsLoading = false;
      eventsFallbackAttempted = true;
      loadEvents();
    }
    if ($profile.googleConnected) {
      loadCalendar();
      loadGmail();
      startTwinContextClock();
    }
  }

  // ── Reminders (kept for ResultCard remind actions) ────────────────────────
  $: activeReminders = $reminders.filter(r => !r.done);

  // ── Feed state ────────────────────────────────────────────────────────────
  let recsLoading = true, recsError = false, recs: Card[] = [], recsMessage = '';
  let videosLoading = false, videosError = false, videoCards: Card[] = [], videosMessage = '';
  let tribeLoading = false, tribeError = false, tribeCards: Card[] = [], tribeMessage = '';
  let eventsLoading = false, eventsError = false, eventListCards: Card[] = [], eventsMessage = '';
  let shopLoading = false, shopError = false, shopCards: Card[] = [], shopMessage = '';
  /** After recs load, fetch /api/events only if recs had no event-category cards. */
  let eventsFallbackAttempted = false;
  /** Tribe / videos / shop load after scroll (or idle timeout). */
  let secondaryFeedsLoaded = false;

  import type { NewsFact } from '$lib/stores/feedCache';
  let newsLoading = true, newsError = false, newsFacts: NewsFact[] = [];

  // Google: Calendar + Gmail
  let calLoading = false, calError = false, calEvents: CalendarEvent[] = [];
  let gmailLoading = false, gmailError = false, gmailBullets: string[] = [];
  let calendarPushLoading = false;

  type IgHomeSnapshot = {
    username: string;
    followersCount?: number;
    mediaCount?: number;
    posts: Array<{
      id: string;
      thumbUrl: string;
      captionSnippet: string;
      likeCount?: number;
      commentsCount?: number;
      permalink?: string;
    }>;
    recentComments: Array<{ text: string; username: string; postId: string }>;
  };

  let igSnapshotLoading = false;
  let igSnapshotError = false;
  let igSnapshot: IgHomeSnapshot | null = null;

  $: twinInsightLine = $profile.googleIdentity?.twin?.insights?.[0]?.trim() ?? '';

  $: recsDisplayed = ensureMatchReasons(recs, $profile.googleIdentity?.twin, $twinUiContext);
  $: avatarInitial = (firstName || $profile.name || 'W').trim().charAt(0).toUpperCase();
  $: musicCards  = recsDisplayed.filter(c => ['music','culture'].includes(c.category));
  $: eventCards  = recsDisplayed.filter(c => ['nightlife','experience','travel'].includes(c.category));
  $: foodCards   = recsDisplayed.filter(c => c.category === 'food');
  $: recsShopCards = recsDisplayed.filter(c => ['fashion','deal','fitness','wellness','tech'].includes(c.category));
  $: eventStripCards = eventCards.length > 0 ? eventCards : eventListCards;

  // ── Shared feed cache ────────────────────────────────────────────────────
  import {
    updateFeed, getFeed,
    getCachedLocal as getCached,
    setCachedLocal as setCache,
    getGoogleCachedLocal as getGoogleCached,
    setGoogleCachedLocal as setGoogleCache,
    todaySlotKey as todayKey,
    googleSlotKey as googleCacheKey,
  } from '$lib/stores/feedCache';

  let homeLazyObs: IntersectionObserver | undefined;

  function setupHomeLazyObserver() {
    homeLazyObs?.disconnect();
    homeLazyObs = undefined;
    if (typeof window === 'undefined') return;
    const root = document.getElementById('home-persona-scroll');
    const sentinel = document.getElementById('home-feed-lazy-sentinel');
    if (!root || !sentinel) return;
    homeLazyObs = new IntersectionObserver(
      entries => {
        if (entries.some(e => e.isIntersecting)) {
          ensureHomeContextLoaded();
          ensureSecondaryFeedsLoaded();
          homeLazyObs?.disconnect();
          homeLazyObs = undefined;
        }
      },
      { root, rootMargin: '160px 0px', threshold: 0 },
    );
    homeLazyObs.observe(sentinel);
  }

  let homeLazyObsReady = false;
  afterUpdate(() => {
    if (homeLazyObsReady || typeof window === 'undefined') return;
    const root = document.getElementById('home-persona-scroll');
    const sentinel = document.getElementById('home-feed-lazy-sentinel');
    if (!root || !sentinel) return;
    homeLazyObsReady = true;
    setupHomeLazyObserver();
  });

  // ── Load ──────────────────────────────────────────────────────────────────
  onMount(() => {
    // Always reset loading states for feeds — they are now lazy (deep view)
    recsLoading = false; videosLoading = false; tribeLoading = false;
    eventsLoading = false; shopLoading = false; newsLoading = false;

    if (!$profile.setupComplete) {
      personaLoading = false;
      return;
    }

    // Track last visit
    profile.update(p => ({ ...p, lastVisit: new Date().toISOString() }));

    const cached = loadHomePersonaFromSession($profile.googleSub);
    if (cached) {
      applyHomePersonaPayload(cached);
      personaLoading = false;
    }

    // Stale-while-revalidate: refresh from API without skeleton when cache had a snapshot
    void loadPersona();
    twinMemKey = twinMemKeyForProfile($profile);
    twinMem = loadTwinMemory(twinMemKey);
    memoryKey = memoryKeyForProfile($profile);
    const local = loadChatMemory(memoryKey);
    threadSummary = local.summary ?? '';
    userTurnsSinceSummary = local.messages.filter(m => m.role === 'user').length % SUMMARY_EVERY_USER_TURNS;
    if (local.messages?.length) {
      homeChatMessages = local.messages.map(m => ({
        role: m.role,
        text: m.text,
        at: m.at,
        cards: m.role === 'ai' ? cardRefsToCards(m.cardRefs) : [],
      }));
    }
    const sub = $profile.googleSub?.trim();
    if (sub) {
      void (async () => {
        try {
          const r = await fetch(`/api/chat/thread?sub=${encodeURIComponent(sub)}`);
          if (r.ok) {
            const d = (await r.json()) as { thread?: unknown };
            const nowLocal = loadChatMemory(memoryKey);
            const merged = pickNewerThread(nowLocal, d.thread ?? null);
            const same =
              merged.messages.length === nowLocal.messages.length &&
              (merged.updatedAt || '') === (nowLocal.updatedAt || '') &&
              (merged.summary ?? '') === (nowLocal.summary ?? '') &&
              JSON.stringify(merged.messages) === JSON.stringify(nowLocal.messages);
            if (!same) {
              threadSummary = merged.summary ?? '';
              userTurnsSinceSummary = merged.messages.filter(m => m.role === 'user').length % SUMMARY_EVERY_USER_TURNS;
              if (merged.messages?.length) {
                homeChatMessages = merged.messages.map(m => ({
                  role: m.role,
                  text: m.text,
                  at: m.at,
                  cards: m.role === 'ai' ? cardRefsToCards(m.cardRefs) : [],
                }));
              } else if (!nowLocal.messages.length) {
                homeChatMessages = [];
              }
              saveChatMemory(memoryKey, merged);
            }
          }
        } catch {
          /* keep local */
        }
      })();
    }
    if ($profile.googleConnected) {
      void loadCalendar();
      startTwinContextClock();
    }
    homePromptTimer = setInterval(() => {
      if (homeChatMode !== 'learn') return;
      homePromptIndex = (homePromptIndex + 1) % HOME_PROMPTS_LEARN.length;
      homeQuestionPrompt = HOME_PROMPTS_LEARN[homePromptIndex];
    }, 8000);

    return () => {
      homeLazyObs?.disconnect();
      if (homePromptTimer) clearInterval(homePromptTimer);
      if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
    };
  });

  function ensureSecondaryFeedsLoaded() {
    if (!$profile.setupComplete || secondaryFeedsLoaded) return;
    secondaryFeedsLoaded = true;

    const hasAnyPlatform =
      $profile.instagramConnected || $profile.spotifyConnected || $profile.appleMusicConnected ||
      $profile.googleConnected || $profile.youtubeConnected || $profile.linkedinConnected;

    if ($profile.instagramConnected) {
      loadTribe();
      loadIgSnapshot();
    } else {
      tribeLoading = false;
    }

    if ($profile.googleConnected || $profile.youtubeConnected) loadVideos();
    else videosLoading = false;

    if (hasAnyPlatform || ($profile.interests?.length ?? 0) > 0) loadShop();
    else shopLoading = false;
  }

  async function fetchSection<T extends { cards?: unknown[]; facts?: unknown[] }>(
    key: string,
    url: string,
    body: unknown,
    onSuccess: (data: T) => void,
    setLoading: (v: boolean) => void,
    setError: (v: boolean) => void,
    timeout = 30000,
    onSettled?: () => void,
  ) {
    const cached = getCached<T>(key);
    if (cached) {
      onSuccess(cached);
      setLoading(false);
      onSettled?.();
      return;
    }

    setLoading(true); setError(false);
    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), timeout);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctl.signal,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error('Failed');
      const data: T = await res.json();
      setCache(key, data);
      onSuccess(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      onSettled?.();
    }
  }

  function loadRecs() {
    fetchSection(
      'home_recs',
      '/api/recommendations',
      { profile: $profile, googleSub: $profile.googleSub },
      (d: { message: string; cards: Card[] }) => { recs = d.cards ?? []; recsMessage = d.message ?? ''; },
      v => (recsLoading = v),
      v => (recsError = v),
      30000,
      () => {
        if (!$profile.setupComplete) return;
        const ev = recs.filter(c => ['nightlife', 'experience', 'travel'].includes(c.category));
        if (ev.length > 0) {
          eventListCards = [];
          eventsLoading = false;
          eventsError = false;
          return;
        }
        if (!eventsFallbackAttempted) {
          eventsFallbackAttempted = true;
          loadEvents();
        }
      },
    );
  }

  function loadTribe() {
    fetchSection(
      'home_tribe',
      '/api/social',
      { profile: $profile, googleSub: $profile.googleSub },
      (d: { message: string; cards: Card[] }) => { tribeCards = d.cards ?? []; tribeMessage = d.message ?? ''; },
      v => (tribeLoading = v),
      v => (tribeError = v),
    );
  }

  async function loadIgSnapshot() {
    const sub = $profile.googleSub?.trim();
    if (!$profile.instagramConnected || !sub) {
      igSnapshot = null;
      return;
    }
    igSnapshotLoading = true;
    igSnapshotError = false;
    try {
      const res = await fetch('/api/instagram/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleSub: sub }),
      });
      const data = (await res.json()) as { ok?: boolean; snapshot?: IgHomeSnapshot | null };
      if (!res.ok) {
        igSnapshotError = true;
        igSnapshot = null;
      } else {
        igSnapshot = data.snapshot ?? null;
      }
    } catch {
      igSnapshotError = true;
      igSnapshot = null;
    } finally {
      igSnapshotLoading = false;
    }
  }

  function loadVideos() {
    fetchSection(
      'home_videos',
      '/api/videos',
      { profile: $profile, googleSub: $profile.googleSub },
      (d: { message: string; cards: Card[] }) => { videoCards = d.cards ?? []; videosMessage = d.message ?? ''; },
      v => (videosLoading = v),
      v => (videosError = v),
    );
  }

  function loadEvents() {
    fetchSection(
      'home_events',
      '/api/events',
      { profile: $profile, googleSub: $profile.googleSub },
      (d: { message: string; cards: Card[] }) => { eventListCards = d.cards ?? []; eventsMessage = d.message ?? ''; },
      v => (eventsLoading = v),
      v => (eventsError = v),
    );
  }

  function loadShop() {
    fetchSection(
      'home_shop',
      '/api/shop',
      { profile: $profile, googleSub: $profile.googleSub },
      (d: { message: string; cards: Card[] }) => { shopCards = d.cards ?? []; shopMessage = d.message ?? ''; },
      v => (shopLoading = v),
      v => (shopError = v),
    );
  }

  function loadNews() {
    fetchSection(
      'home_news',
      '/api/news',
      { profile: $profile, googleSub: $profile.googleSub },
      (d: { facts: NewsFact[] }) => { newsFacts = d.facts ?? []; },
      v => (newsLoading = v),
      v => (newsError = v),
    );
  }

  async function loadHomeFeed() {
    const cachedRecs = getCached<{ message: string; cards: Card[] }>('home_recs');
    const cachedNews = getCached<{ facts: NewsFact[] }>('home_news');

    if (cachedRecs?.cards?.length) {
      recs = cachedRecs.cards; recsMessage = cachedRecs.message ?? ''; recsLoading = false;
      updateFeed({ recs: cachedRecs.cards });
      const ev = recs.filter(c => ['nightlife','experience','travel'].includes(c.category));
      if (ev.length === 0 && !eventsFallbackAttempted) { eventsFallbackAttempted = true; loadEvents(); }
    }
    if (cachedNews?.facts?.length) {
      newsFacts = cachedNews.facts; newsLoading = false;
      updateFeed({ news: cachedNews.facts });
    }
    if (cachedRecs?.cards?.length && cachedNews?.facts?.length) return;

    if (!cachedRecs?.cards?.length) recsLoading = true;
    if (!cachedNews?.facts?.length) newsLoading = true;

    try {
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 45000);
      const res = await fetch('/api/home-feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: $profile, googleSub: $profile.googleSub }),
        signal: ctl.signal,
      });
      clearTimeout(t);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();

      if (!cachedRecs?.cards?.length && data.recs) {
        recs = data.recs.cards ?? []; recsMessage = data.recs.message ?? '';
        if (recs.length) { setCache('home_recs', data.recs); updateFeed({ recs }); }
        const ev = recs.filter(c => ['nightlife','experience','travel'].includes(c.category));
        if (ev.length === 0 && !eventsFallbackAttempted) { eventsFallbackAttempted = true; loadEvents(); }
      }
      if (!cachedNews?.facts?.length && data.news) {
        newsFacts = data.news.facts ?? [];
        if (newsFacts.length) { setCache('home_news', data.news); updateFeed({ news: newsFacts }); }
      }
    } catch {
      if (!cachedRecs?.cards?.length) recsError = true;
      if (!cachedNews?.facts?.length) newsError = true;
    } finally {
      recsLoading = false;
      newsLoading = false;
    }
  }

  function refreshAll() {
    ['home_recs','home_tribe','home_videos','home_events','home_shop','home_news'].forEach(k => {
      localStorage.removeItem(todayKey(k));
    });
    eventsFallbackAttempted = false;
    secondaryFeedsLoaded = true;
    recs = []; tribeCards = []; videoCards = []; eventListCards = []; shopCards = []; newsFacts = [];
    recsError = false; tribeError = false; videosError = false; eventsError = false; shopError = false; newsError = false;
    loadRecs(); loadTribe(); loadVideos(); loadShop(); loadNews();
    if ($profile.instagramConnected) void loadIgSnapshot();
    if ($profile.googleConnected && $profile.googleAccessToken) { loadCalendar(); loadGmail(); }
  }

  // Google cache helpers imported from feedCache store above

  // ── Google Calendar ───────────────────────────────────────────────────────
  async function loadCalendar() {
    const cached = getGoogleCached<CalendarEvent[]>('cal');
    if (cached?.length) {
      calEvents = cached;
      calLoading = false;
      updateTwinContextFromCalendar(calEvents);
      return;
    }

    calLoading = true; calError = false;
    try {
      let token = $profile.googleAccessToken;

      // If no access token, go straight to refresh
      if (!token && $profile.googleRefreshToken) {
        const rr = await fetch('/api/google/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: $profile.googleRefreshToken }),
        });
        if (rr.ok) {
          const { accessToken } = await rr.json();
          token = accessToken;
          profile.update(p => ({ ...p, googleAccessToken: accessToken }));
        }
      }

      if (!token) { calError = true; calLoading = false; return; }

      let res = await fetch('/api/google/calendar', {
        headers: { 'x-google-token': token },
      });

      // If 401, try refreshing the token once
      if (res.status === 401 && $profile.googleRefreshToken) {
        const refreshRes = await fetch('/api/google/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: $profile.googleRefreshToken }),
        });
        if (refreshRes.ok) {
          const { accessToken } = await refreshRes.json();
          token = accessToken;
          profile.update(p => ({ ...p, googleAccessToken: accessToken }));
          res = await fetch('/api/google/calendar', {
            headers: { 'x-google-token': token },
          });
        }
      }

      const data = await res.json();
      if (data.error) console.error('[Calendar home]', data.error);
      calEvents = data.events ?? [];
      updateTwinContextFromCalendar(calEvents);
      if (calEvents.length) setGoogleCache('cal', calEvents);
      // If still empty after fetch, don't cache — let it retry next time
    } catch (e) {
      console.error('[Calendar home catch]', e);
      calError = true;
    } finally {
      calLoading = false;
    }
  }

  let pushDone = false;
  async function pushReminderToCalendar(title: string) {
    if (!$profile.googleConnected || !$profile.googleAccessToken) return;
    calendarPushLoading = true;
    const start = new Date();
    start.setHours(start.getHours() + 1, 0, 0, 0);
    const end = new Date(start.getTime() + 30 * 60 * 1000);
    try {
      const res = await fetch('/api/google/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: $profile.googleAccessToken,
          refreshToken: $profile.googleRefreshToken,
          event: { title, start: start.toISOString(), end: end.toISOString(), description: 'Added via Wagwan AI' },
        }),
      });
      const data = await res.json();
      if (data.newToken) profile.update(p => ({ ...p, googleAccessToken: data.newToken }));
      if (data.ok) { pushDone = true; setTimeout(() => (pushDone = false), 2000); }
    } finally {
      calendarPushLoading = false;
    }
  }

  // ── Gmail summary ─────────────────────────────────────────────────────────
  async function loadGmail() {
    const cached = getGoogleCached<string[]>('gmail');
    if (cached) { gmailBullets = cached; gmailLoading = false; return; }

    gmailLoading = true; gmailError = false;
    try {
      const res = await fetch('/api/google/gmail', {
        headers: { 'x-google-token': $profile.googleAccessToken },
      });
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      gmailBullets = data.bullets ?? [];
      if (gmailBullets.length) setGoogleCache('gmail', gmailBullets);
    } catch {
      gmailError = true;
    } finally {
      gmailLoading = false;
    }
  }

  // ── Calendar helpers ──────────────────────────────────────────────────────
  function fmtEventTime(e: CalendarEvent): string {
    if (e.allDay) return 'All day';
    return new Date(e.start).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  }
  function fmtEventDay(e: CalendarEvent): string {
    const d = new Date(e.start);
    const t = new Date();
    if (d.toDateString() === t.toDateString()) return 'Today';
    const tomorrow = new Date(t); tomorrow.setDate(t.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' });
  }
  function isToday(e: CalendarEvent): boolean {
    return new Date(e.start).toDateString() === new Date().toDateString();
  }

  // Inline gradient per category — bypasses CSS class resolution entirely
  const CAT_GRAD: Record<string, string> = {
    music:      'linear-gradient(135deg,#4c1d95,#818cf8)',
    culture:    'linear-gradient(135deg,#4c1d95,#818cf8)',
    food:       'linear-gradient(135deg,#991b1b,#ef4444)',
    nightlife:  'linear-gradient(135deg,#3b0764,#a855f7)',
    experience: 'linear-gradient(135deg,#3b0764,#a855f7)',
    fitness:    'linear-gradient(135deg,#065f46,#10b981)',
    wellness:   'linear-gradient(135deg,#065f46,#10b981)',
    fashion:    'linear-gradient(135deg,#701a75,#e879f9)',
    travel:     'linear-gradient(135deg,#14532d,#4ade80)',
    tech:       'linear-gradient(135deg,#0c4a6e,#38bdf8)',
    deal:       'linear-gradient(135deg,#92400e,#fbbf24)',
    job:        'linear-gradient(135deg,#1e3a8a,#3b82f6)',
    video:      'linear-gradient(135deg,#7f1d1d,#f87171)',
    product:    'linear-gradient(135deg,#1e293b,#64748b)',
  };
  function cardGrad(category: string) {
    return CAT_GRAD[category] ?? 'linear-gradient(135deg,#312e81,#818cf8)';
  }
  function openCardUrl(url: string, title: string) {
    const dest = url?.startsWith('http') ? url : `https://www.google.com/search?q=${encodeURIComponent(title)}`;
    window.open(dest, '_blank', 'noopener,noreferrer');
  }

  async function sendExpressionFeedback(targetId: string, vote: 'up' | 'down', ref?: string) {
    const sub = $profile.googleSub;
    if (!sub) return;
    try {
      await fetch('/api/expression/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ googleSub: sub, targetId, vote, ref }),
      });
    } catch {
      /* ignore */
    }
  }

  // ── Insight carousel data ──
  $: insightCards = (() => {
    const cards: Array<{ id: string; icon: any; category: string; statement: string; supporting?: string }> = [];

    // Card 1: Intelligence — mode + momentum
    const intel = personaIntelligence?.payload;
    if (intel?.snapshot?.one_line_state) {
      const mode = intel.snapshot.mode ? `${intel.snapshot.mode.charAt(0).toUpperCase() + intel.snapshot.mode.slice(1)} mode` : '';
      const momentum = intel.now?.momentum || '';
      cards.push({
        id: 'intelligence',
        icon: Lightning,
        category: 'INTELLIGENCE',
        statement: intel.snapshot.one_line_state,
        supporting: [mode, momentum ? `Momentum: ${momentum}` : ''].filter(Boolean).join(' · '),
      });
    }

    // Card 2: Snapshot — core contradiction
    const contradiction = personaSnapshot?.payload?.core_contradiction?.trim();
    if (contradiction) {
      cards.push({
        id: 'snapshot',
        icon: Scales,
        category: 'SNAPSHOT',
        statement: contradiction,
        supporting: 'Your core contradiction',
      });
    }

    // Card 3: Prediction / non-obvious insight
    const insight = personaHyperCompact?.non_obvious_insights?.[0]?.trim();
    const prediction = personaHyperCompact?.predictions?.[0];
    const next30 = personaHyperCompact?.next_30_days?.[0]?.trim();
    if (insight) {
      cards.push({
        id: 'prediction',
        icon: TrendUp,
        category: 'PREDICTION',
        statement: insight,
      });
    } else if (prediction?.action) {
      cards.push({
        id: 'prediction',
        icon: TrendUp,
        category: 'PREDICTION',
        statement: prediction.action,
        supporting: prediction.timeframe || '',
      });
    } else if (next30) {
      cards.push({
        id: 'prediction',
        icon: TrendUp,
        category: 'PREDICTION',
        statement: next30,
        supporting: 'Next 30 days',
      });
    }

    return cards;
  })();

  // ── For You tabs data ──
  $: forYouTabs = (() => {
    const tabs: Array<{ id: string; label: string; emoji: string; cards: any[] }> = [];

    const mapCard = (c: Card) => ({
      title: c.title,
      description: c.description,
      price: c.price,
      url: c.url,
      category: c.category,
      match_score: c.match_score,
      emoji: c.emoji,
      image_url: c.image_url,
    });

    if (musicCards.length) tabs.push({ id: 'music', label: 'Music', emoji: '🎵', cards: musicCards.slice(0, 4).map(mapCard) });
    if (recsShopCards.length || shopCards.length) {
      const style = recsShopCards.length ? recsShopCards : shopCards;
      tabs.push({ id: 'style', label: 'Style', emoji: '👗', cards: style.slice(0, 4).map(mapCard) });
    }
    if (foodCards.length) tabs.push({ id: 'eat', label: 'Eat', emoji: '🍜', cards: foodCards.slice(0, 4).map(mapCard) });
    const doCards = [...eventCards, ...eventListCards].filter((c, i, a) => a.findIndex(x => x.url === c.url) === i);
    if (doCards.length) tabs.push({ id: 'do', label: 'Do', emoji: '🎟️', cards: doCards.slice(0, 4).map(mapCard) });
    if (videoCards.length) tabs.push({ id: 'watch', label: 'Watch', emoji: '📺', cards: videoCards.slice(0, 4).map(mapCard) });

    return tabs;
  })();

  // ── Hero data ──
  $: heroOneLiner = personaSnapshot?.payload?.one_liner
    || personaIntelligence?.payload?.snapshot?.one_line_state
    || inferenceCompact?.predictive_one_liner
    || '';
  $: heroArchetype = personaSnapshot?.payload?.archetype || '';
  $: heroMode = personaSnapshot?.payload?.current_mode
    || personaIntelligence?.payload?.snapshot?.mode
    || '';
  $: heroVibeTags = personaSnapshot?.payload?.vibe?.slice(0, 4) || [];
</script>


{#if showShareModal && personaSnapshot}
  <ShareCardModal
    snapshot={personaSnapshot}
    photoUrl={photoUrl}
    on:close={() => (showShareModal = false)}
  />
{/if}

<div class="home-page-root" data-home-surface="dark">
  <PersonaBg photoUrl={photoUrl} dark />

  <div class="home-shell">
    <HeroIdentity
      displayName={$profile.name?.trim() || firstName}
      photoUrl={photoUrl}
      avatarInitial={avatarInitial}
      oneLiner={heroOneLiner}
      archetype={heroArchetype}
      mode={heroMode}
      vibeTags={heroVibeTags}
      city={city}
      loading={personaLoading && !hasHomeHeaderContent}
      regenerating={personaRegenerating}
      on:share={() => (showShareModal = true)}
      on:refresh={regeneratePersona}
    />

    {#if insightCards.length > 0}
      <section class="home-section home-section--insights">
        <InsightCarousel
          insights={insightCards}
          on:select={(e) => { /* TODO: open detail sheet */ }}
        />
      </section>
    {/if}

    {#if forYouTabs.length > 0 || recsLoading}
      <section class="home-section home-section--foryou">
        <h2 class="home-section__title">For you</h2>
        <ForYouTabs
          tabs={forYouTabs}
          loading={recsLoading}
          on:feedback={(e) => sendExpressionFeedback(e.detail.title, e.detail.vote)}
        />
      </section>
    {/if}

    <div class="home-bottom-spacer"></div>
  </div>

  <div class="home-ask-bar">
    <QuickAskBar
      placeholder="Ask about yourself..."
      micSupported={isSpeechRecognitionSupported()}
      on:submit={() => goto('/ai')}
      on:mic={toggleListenHome}
    />
  </div>
</div>

<style>
  .home-page-root {
    position: relative;
    min-height: 100vh;
    min-height: 100dvh;
    overflow-y: auto;
    overflow-x: hidden;
  }

  .home-shell {
    position: relative;
    z-index: 1;
    max-width: 720px;
    margin: 0 auto;
    padding: 0 20px;
  }

  .home-section {
    margin-top: 40px;
  }

  .home-section--insights {
    margin-top: 32px;
  }

  .home-section__title {
    font-family: var(--font-sans);
    font-size: 13px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin: 0 0 16px;
    padding: 0 4px;
  }

  .home-bottom-spacer {
    height: calc(140px + env(safe-area-inset-bottom, 0px));
  }

  .home-ask-bar {
    position: fixed;
    left: 0;
    right: 0;
    bottom: calc(64px + env(safe-area-inset-bottom, 0px));
    z-index: 60;
    pointer-events: none;
  }

  .home-ask-bar :global(*) {
    pointer-events: auto;
  }

  @media (min-width: 1024px) {
    .home-shell {
      padding: 0 40px;
    }
  }
</style>
