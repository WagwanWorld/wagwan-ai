<script lang="ts">
  import { onMount, onDestroy, afterUpdate, tick } from 'svelte';
  import { goto } from '$app/navigation';
  import { profile } from '$lib/stores/profile';
  import { reminders } from '$lib/stores/reminders';
  import ResultCard from '$lib/components/ResultCard.svelte';
  import type { ResultCard as Card } from '$lib/utils';
  import { getYouTubeId } from '$lib/utils';
  import type { CalendarEvent } from '$lib/server/google';
  import {
    suggestionHeroUrl,
    quickAskImage,
    newsRowImage,
  } from '$lib/suggestionImagery';
  import DayReveal from '$lib/components/DayReveal.svelte';
  import GlassPanel from '$lib/components/GlassPanel.svelte';
  import AppleMusicPlayRow from '$lib/components/AppleMusicPlayRow.svelte';
  import PersonaBg from '$lib/components/PersonaBg.svelte';
  import HomeIdentityHeader from '$lib/components/HomeIdentityHeader.svelte';
  import HomeCurrentReadCard from '$lib/components/HomeCurrentReadCard.svelte';
  import InferenceIdentityPanel from '$lib/components/InferenceIdentityPanel.svelte';
  import IdentityIntelligencePanel from '$lib/components/IdentityIntelligencePanel.svelte';
  import HomeIdentitySynthesisPanel from '$lib/components/HomeIdentitySynthesisPanel.svelte';
  import ShareCardModal from '$lib/components/ShareCardModal.svelte';
  import type { IdentitySnapshotWrapper } from '$lib/types/identitySnapshot';
  import type { IdentityIntelligenceWrapper } from '$lib/types/identityIntelligence';
  import type { IdentitySynthesisWrapper } from '$lib/types/identitySynthesis';
  import type { IdentityMusicContext } from '$lib/types/identityMusicContext';
  import type { InferenceIdentityWrapper, InferenceLifeDomainId } from '$lib/types/inferenceIdentity';
  import { getSpeechRecognition, isSpeechRecognitionSupported } from '$lib/voice/speech';
  import { Mic, Send, Plus, Camera, Music, Briefcase, ThumbsUp, ThumbsDown } from '@lucide/svelte';
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
</script>

<div class="home-page-root" data-home-surface="dark">
  <!-- Fixed blurred photo + identity-tinted background -->
  <PersonaBg photoUrl={photoUrl} dark />

  <div class="home-aurora home-aurora--breathe" aria-hidden="true"></div>

  <div class="home-shell">
    <div class="home-split">
      <div class="home-identity-col">
      <div id="home-persona-scroll" class="home-persona-scroll">
    <HomeIdentityHeader
      displayName={$profile.name?.trim() || firstName}
      photoUrl={photoUrl}
      avatarInitial={avatarInitial}
      city={city}
      snapshot={personaSnapshot}
      intelligence={personaIntelligence}
      fallbackOneLiner={headerFallbackOneLiner}
      loading={personaLoading && !hasHomeHeaderContent}
      regenerating={personaRegenerating}
      on:share={() => (showShareModal = true)}
      on:refresh={regeneratePersona}
    />

    <div class="home-feed-pad">
      <div class="home-deep-persona__title">Your day</div>
      {#if currentReadLines.length}
        <section class="home-profile-module home-profile-module--flat">
          <HomeCurrentReadCard lines={currentReadLines} confidence={currentReadConfidence} />
        </section>
      {/if}
      <section class="home-profile-module home-profile-module--flat">
        <div class="home-primary-label">Signals</div>
        {#if inferenceMetaLine}
          <p class="home-signals-meta">{inferenceMetaLine}</p>
        {/if}
        {#if personaSignalDominantPatterns.length}
          <p class="home-signals-patterns" aria-label="Dominant patterns">
            {personaSignalDominantPatterns.map(p => p.replace(/_/g, ' ')).join(' · ')}
          </p>
        {/if}
        <div class="home-signal-strip" role="region" aria-label="Signals">
          {#each interpretedSignals as signal}
            <article class="home-signal-mod">
              <div class="home-signal-mod__ico" aria-hidden="true">
                {#if signal.source === 'Instagram'}
                  <Camera size={18} strokeWidth={1.85} />
                {:else if signal.source === 'Music'}
                  <Music size={18} strokeWidth={1.85} />
                {:else}
                  <Briefcase size={18} strokeWidth={1.85} />
                {/if}
              </div>
              <p class="home-signal-mod__src">{signal.source}</p>
              <p class="home-signal-mod__read">{signal.read}</p>
              <div class="home-signal-mod__meter" aria-hidden="true">
                <span
                  class="home-signal-mod__meter-fill"
                  style="width:{Math.round(signal.confidence * 100)}%"
                ></span>
              </div>
            </article>
          {/each}
        </div>
      </section>
    </div>

    {#if personaIdentitySynthesis || personaInference || personaIntelligence?.payload}
    <div class="home-more-about home-feed-pad">
      <div class="home-deep-persona__title">What we know about you</div>

      {#if personaIdentitySynthesis}
        <section class="home-profile-module home-profile-module--flat home-identity-synthesis">
          <HomeIdentitySynthesisPanel
            synthesis={personaIdentitySynthesis}
            photoUrl={photoUrl}
            regenerating={personaRegenerating}
            musicContext={identityMusicContext}
            on:regenerate={regeneratePersona}
          />
        </section>
      {/if}

      {#if personaInference}
        <section class="home-profile-module home-profile-module--flat">
          <div class="home-earn-panel-host home-earn-panel-host--flush">
            <InferenceIdentityPanel inference={personaInference} variant="home" />
          </div>
        </section>
      {/if}

      {#if personaIntelligence?.payload}
        <section class="home-profile-module home-profile-module--flat">
          <div class="home-earn-panel-host home-earn-panel-host--flush home-earn-panel-host--intel">
            <IdentityIntelligencePanel intelligence={personaIntelligence} variant="home" />
          </div>
        </section>
      {/if}
    </div>
    {/if}

    <div id="home-more-context" class="home-context-anchor" aria-hidden="true"></div>

    {#if personaHyperCompact?.taste_mechanism || personaHyperCompact?.next_30_days?.length || personaHyperCompact?.predictions?.length || personaHyperCompact?.non_obvious_insights?.length}
      <section class="home-profile-module home-profile-module--flat home-hyper-block" aria-label="Deep inference">
        <div class="home-primary-label">Deep inference</div>
        {#if personaHyperCompact.archetype?.trim()}
          <p class="home-hyper-taste">{personaHyperCompact.archetype}</p>
        {:else if personaHyperCompact.taste_mechanism}
          <p class="home-hyper-taste">{personaHyperCompact.taste_mechanism}</p>
        {/if}
        {#if personaHyperCompact.true_intent?.trim()}
          <p class="home-hyper-intent">{personaHyperCompact.true_intent}</p>
        {/if}
        {#if personaHyperCompact.predictions?.length}
          <p class="home-hyper-next">
            <span class="home-hyper-tag">Likely next</span>
            {personaHyperCompact.predictions[0]?.action ?? ''}
            {#if personaHyperCompact.predictions[0]?.timeframe}
              <span class="text-[var(--text-muted)]"> · {personaHyperCompact.predictions[0].timeframe}</span>
            {/if}
          </p>
        {:else if personaHyperCompact.next_30_days?.length}
          <p class="home-hyper-next">
            <span class="home-hyper-tag">Next ~30d</span>
            {personaHyperCompact.next_30_days[0]}
          </p>
        {/if}
        {#if personaHyperCompact.non_obvious_insights?.length}
          <ul class="home-hyper-insights">
            {#each personaHyperCompact.non_obvious_insights.slice(0, 3) as line}
              <li>{line}</li>
            {/each}
          </ul>
        {/if}
      </section>
    {/if}

        <div class="deep-view-cta-wrap">
        <button type="button" class="deep-view-btn" on:click={() => void ensureHomeContextLoadedAndScroll()}>
          More context
        </button>
      </div>

    <div class="home-below">
      <div class="home-below-sheet home-below-sheet--expanded">

      <div class="home-deep-persona home-feed-pad">

        {#if personaSignalHighlights.length}
          <section class="home-profile-module">
            <div class="home-primary-label">Ranked signals</div>
            <ul class="home-signal-meter-list">
              {#each personaSignalHighlights.slice(0, 8) as h}
                <li class="home-signal-meter-row">
                  <span class="home-signal-meter-cat">{h.category}</span>
                  <span class="home-signal-meter-val">{h.value}</span>
                  <span class="home-signal-meter-score">{Math.round(h.final_score * 100)}</span>
                </li>
              {/each}
            </ul>
          </section>
        {/if}

      <div class="home-unified-deck">
        <div class="home-deep-persona__title">Shortcuts</div>
        <div class="twin-deck twin-deck--unified">
          <button
            type="button"
            class="twin-deck-btn"
            on:click={() => goto(`/ai?q=${encodeURIComponent('Summarise what needs attention in my inbox')}`)}
          >
            <span class="twin-deck-ico">✉️</span>
            <span class="twin-deck-title">Inbox</span>
            <span class="twin-deck-stat">{gmailLoading ? '…' : gmailBullets[0]?.slice(0, 36) || 'Ask'}</span>
          </button>
          <button
            type="button"
            class="twin-deck-btn"
            on:click={() => goto(`/ai?q=${encodeURIComponent("What's on my calendar today")}`)}
          >
            <span class="twin-deck-ico">📅</span>
            <span class="twin-deck-title">Calendar</span>
            <span class="twin-deck-stat">{calLoading ? '…' : calEvents.filter(isToday).length ? `${calEvents.filter(isToday).length} today` : 'Next'}</span>
          </button>
          <button
            type="button"
            class="twin-deck-btn"
            on:click={() => goto(`/ai?q=${encodeURIComponent('How is my Instagram momentum and aesthetic lately')}`)}
          >
            <span class="twin-deck-ico">📸</span>
            <span class="twin-deck-title">Instagram</span>
            <span class="twin-deck-stat">{$profile.instagramIdentity?.username ? '@' + $profile.instagramIdentity.username : 'Connect'}</span>
          </button>
          <button
            type="button"
            class="twin-deck-btn"
            on:click={() => goto(`/ai?q=${encodeURIComponent('Music and artists that match my vibe right now')}`)}
          >
            <span class="twin-deck-ico">🎵</span>
            <span class="twin-deck-title">Music</span>
            <span class="twin-deck-stat">{$profile.spotifyIdentity?.vibeDescription?.slice(0, 28) || $profile.appleMusicIdentity?.vibeDescription?.slice(0, 28) || 'Vibe'}</span>
          </button>
        </div>
      </div>

      <!-- ── Live signals (connected platforms) ─────────────────────────── -->
      {#if $profile.setupComplete && ($profile.googleConnected || $profile.instagramConnected || $profile.linkedinConnected || $profile.appleMusicConnected || $profile.spotifyConnected || $profile.youtubeConnected)}
      <div class="home-live-signals-pad home-live-signals--stacked">
        <GlassPanel r16 clip>
          <div class="home-live-head">
            <div>
              <div class="ui-kicker-title">Live signals</div>
              <div class="ui-kicker-sub">Snapshot from your connected accounts</div>
            </div>
            <a href="/profile" class="home-live-profile-link">Profile</a>
          </div>

          {#if $profile.googleConnected}
          <div class="home-live-block ui-divider-top">
            <div class="home-live-label">Google</div>
            <p class="home-live-line">
              {#if calLoading}
                Loading calendar…
              {:else if calEvents.filter(isToday).length}
                Today: {calEvents.filter(isToday).length} event{calEvents.filter(isToday).length === 1 ? '' : 's'}
                — {calEvents.filter(isToday)[0]?.title?.slice(0, 42) || ''}
              {:else}
                No events on the calendar today
              {/if}
            </p>
            <p class="home-live-line">
              {#if gmailLoading}
                Loading inbox…
              {:else if gmailBullets.length}
                Inbox: {gmailBullets[0]?.slice(0, 120) || 'Recent mail loaded'}
              {:else if ($profile.googleIdentity?.emailThemes?.length ?? 0) > 0}
                Themes: {($profile.googleIdentity?.emailThemes ?? []).slice(0, 2).join(' · ')}
              {:else}
                Inbox highlights appear when mail loads
              {/if}
            </p>
            {#if twinInsightLine}
              <div class="home-live-hint-stack">
                <span class="home-live-source-tag">Calendar &amp; email</span>
                <p class="home-live-hint">{twinInsightLine.slice(0, 160)}{twinInsightLine.length > 160 ? '…' : ''}</p>
              </div>
            {/if}
            {#if showGoogleInferenceHint}
              <div class="home-live-hint-stack home-live-hint-stack--infer ui-divider-top">
                <span class="home-live-source-tag">Inference</span>
                <p class="home-live-hint">{googleInferenceLine}</p>
              </div>
            {/if}
          </div>
          {/if}

          {#if $profile.youtubeConnected || $profile.googleIdentity?.topChannels?.length}
          <div class="home-live-block ui-divider-top">
            <div class="home-live-label">YouTube</div>
            <p class="home-live-line">
              {#if videosLoading && !videoCards.length}
                Loading your watch picks…
              {:else if videoCards.length}
                {videoCards.length} personalised picks below in “Watch this”
              {:else}
                Channels you follow feed recommendations — open Watch this below
              {/if}
            </p>
            {#if $profile.googleIdentity?.topChannels?.slice(0, 2).length}
              <p class="home-live-meta">Subscriptions: {$profile.googleIdentity.topChannels.slice(0, 3).join(', ')}</p>
            {/if}
          </div>
          {/if}

          {#if $profile.appleMusicConnected && $profile.appleMusicIdentity}
          {@const am = $profile.appleMusicIdentity}
          <div class="home-live-block ui-divider-top">
            <div class="home-live-label">Apple Music</div>
            {#if (am.heavyRotationTracks?.length ?? 0) > 0}
              <p class="home-live-meta">Heavy rotation (tracks & albums)</p>
              <div class="home-live-am-tracks">
                {#each (am.heavyRotationTracks ?? []).slice(0, 3) as tr}
                  <AppleMusicPlayRow hint={tr} />
                {/each}
              </div>
            {/if}
            {#if (am.recentlyPlayed?.length ?? 0) > 0}
              <p class="home-live-meta">Recently played</p>
              <div class="home-live-am-tracks">
                {#each (am.recentlyPlayed ?? []).slice(0, 3) as tr}
                  <AppleMusicPlayRow hint={tr} />
                {/each}
              </div>
            {/if}
            {#if !(am.heavyRotationTracks?.length) && !(am.recentlyPlayed?.length)}
              <p class="home-live-line">{am.vibeDescription || am.topArtists?.slice(0, 2).join(', ') || 'Connect or reconnect to refresh tracks'}</p>
            {/if}
          </div>
          {:else if $profile.spotifyConnected && $profile.spotifyIdentity?.topTracks?.length}
          <div class="home-live-block ui-divider-top">
            <div class="home-live-label">Spotify</div>
            <p class="home-live-meta">Top tracks</p>
            <ul class="home-live-list">
              {#each $profile.spotifyIdentity.topTracks.slice(0, 3) as t}
                <li>{t}</li>
              {/each}
            </ul>
          </div>
          {/if}

          {#if $profile.instagramConnected}
          <div class="home-live-block ui-divider-top">
            <div class="home-live-label">Instagram</div>
            {#if igSnapshotLoading}
              <p class="home-live-line">Loading posts…</p>
            {:else if igSnapshotError}
              <p class="home-live-line">Couldn’t load live posts. Use Profile → Refresh signals if you use Supabase.</p>
            {:else if igSnapshot}
              <p class="home-live-meta">
                @{igSnapshot.username}
                {#if igSnapshot.followersCount != null}
                  · {igSnapshot.followersCount.toLocaleString()} followers
                {/if}
                {#if igSnapshot.mediaCount != null}
                  · {igSnapshot.mediaCount} posts
                {/if}
              </p>
              {#if igSnapshot.posts.length}
                <div class="home-live-ig-row">
                  {#each igSnapshot.posts as p (p.id)}
                    <a
                      href={p.permalink || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="home-live-ig-thumb-wrap"
                    >
                      {#if p.thumbUrl}
                        <img src={p.thumbUrl} alt="" class="home-live-ig-thumb" loading="lazy" referrerpolicy="no-referrer" />
                      {:else}
                        <div class="home-live-ig-thumb home-live-ig-thumb--empty"></div>
                      {/if}
                      <span class="home-live-ig-cap">{p.captionSnippet.slice(0, 40)}{p.captionSnippet.length > 40 ? '…' : ''}</span>
                      <span class="home-live-ig-stat">
                        {p.likeCount != null ? `❤ ${p.likeCount}` : ''}{p.likeCount != null && p.commentsCount != null ? ' · ' : ''}{p.commentsCount != null ? `💬 ${p.commentsCount}` : ''}
                      </span>
                    </a>
                  {/each}
                </div>
              {:else}
                <p class="home-live-line">No recent posts returned</p>
              {/if}
              {#if igSnapshot.recentComments.length}
                <p class="home-live-meta">Latest comments</p>
                <ul class="home-live-comment-list">
                  {#each igSnapshot.recentComments.slice(0, 5) as c}
                    <li><span class="home-live-c-user">@{c.username}</span> {c.text}</li>
                  {/each}
                </ul>
              {/if}
            {:else}
              <p class="home-live-line">Save your profile to the cloud or refresh signals to load post snapshots.</p>
            {/if}
          </div>
          {/if}

          {#if $profile.linkedinConnected && $profile.linkedinIdentity}
          {@const li = $profile.linkedinIdentity}
          <div class="home-live-block ui-divider-top">
            <div class="home-live-label">LinkedIn</div>
            {#if li.headline}
              <p class="home-live-line">{li.headline.slice(0, 140)}{li.headline.length > 140 ? '…' : ''}</p>
            {/if}
            {#if li.currentRole || li.currentCompany}
              <p class="home-live-meta">{[li.currentRole, li.currentCompany].filter(Boolean).join(' · ')}</p>
            {/if}
            {#if li.skills?.length}
              <p class="home-live-meta">Skills: {li.skills.slice(0, 4).join(', ')}</p>
            {/if}
            <p class="home-live-footnote">Follower counts and post history need expanded LinkedIn API access.</p>
          </div>
          {/if}
        </GlassPanel>
      </div>
      {/if}

        {#if hasHowAcrossBlock && personaSnapshot}
          <section class="home-profile-module">
            <div class="home-primary-label">How I come across</div>
            <div class="home-how-card">
              {#if personaSnapshot.payload.social_identity?.how_people_see_you?.trim()}
                <p class="home-how-line">
                  <span class="home-how-key">Outward read</span>
                  {personaSnapshot.payload.social_identity.how_people_see_you}
                </p>
              {/if}
              {#if personaSnapshot.payload.social_identity?.actual_you?.trim()}
                <p class="home-how-line">
                  <span class="home-how-key">Closer in</span>
                  {personaSnapshot.payload.social_identity.actual_you}
                </p>
              {/if}
              {#if personaSnapshot.payload.core_contradiction?.trim()}
                <div class="home-tension-glow">
                  <p class="home-how-key home-how-key--tension">Tension</p>
                  {#each parseContrastLines(personaSnapshot.payload.core_contradiction) as pair}
                    <p class="home-tension-line">
                      {pair[0]}{#if pair[1]} <span class="home-tension-sep">↔</span> {pair[1]}{/if}
                    </p>
                  {/each}
                </div>
              {/if}
              {#if personaSignalClusters.length}
                <p class="home-how-kicker home-how-kicker--spaced">Strong signal themes</p>
                <div class="home-cluster-list">
                  {#each personaSignalClusters as cluster}
                    <div class="home-cluster">
                      <div class="home-cluster-head">
                        <span class="home-cluster-theme">{cluster.theme}</span>
                        <span class="home-cluster-meter" aria-hidden="true">
                          <span
                            class="home-cluster-meter-fill"
                            style="width:{Math.min(100, Math.round(cluster.intensity * 100))}%"
                          ></span>
                        </span>
                      </div>
                      {#if cluster.signals.length}
                        <div class="home-cluster-signals">
                          {#each cluster.signals as sig}
                            <span class="home-cluster-pill">{sig}</span>
                          {/each}
                        </div>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </div>
          </section>
        {/if}

      </div>

      {#if completeness < 100}
      <div class="home-knows-bar">
        <span>AI knows you</span>
        <span class="home-knows-pct" style="color:{completeness >= 80 ? 'var(--green)' : completeness >= 50 ? 'var(--amber)' : 'var(--accent3)'};">{completeness}%</span>
      </div>
      <div class="home-knows-track"><div class="home-knows-fill" style="width:{completeness}%;background:{completeness >= 80 ? 'linear-gradient(90deg,#00C27A,#34d399)' : completeness >= 50 ? 'linear-gradient(90deg,#F59E0B,#fbbf24)' : 'linear-gradient(90deg,#E5001A,#FF4D60)'};"></div></div>
      {/if}

      </div>
    </div>

  <!-- ── THINGS YOU SHOULD KNOW ───────────────────────────────────────────── -->
  {#if newsLoading || newsFacts.length || newsError}
  <DayReveal>
  <div class="home-feed-pad">
    <GlassPanel r16 clip>

      <!-- Header -->
      <div class="ui-flex-header">
        <div>
          <div class="ui-kicker-title">⚡ Thing to know today</div>
          <div class="ui-kicker-sub">Picked for you · One fresh note per day</div>
        </div>
        {#if !newsLoading && newsFacts.length}
        <button
          on:click={() => { localStorage.removeItem(todayKey('home_news')); newsFacts = []; newsError = false; loadNews(); }}
          style="font-size:11px;color:var(--text3);background:none;border:none;cursor:pointer;padding:4px;"
        >↺</button>
        {/if}
      </div>

      {#if newsLoading}
        <!-- Skeleton -->
        <div class="home-news-skel-row ui-divider-top">
          <div class="skeleton" style="width:44px;height:44px;border-radius:10px;flex-shrink:0;margin-top:1px;"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:4px;">
            <div class="skeleton" style="height:12px;border-radius:5px;width:90%;"></div>
            <div class="skeleton" style="height:12px;border-radius:5px;width:70%;"></div>
            <div class="skeleton" style="height:10px;border-radius:5px;width:30%;"></div>
          </div>
        </div>

      {:else if newsError || newsFacts.length === 0}
        <div class="ui-divider-top" style="padding:14px 16px;">
          <span style="font-size:12px;color:var(--text3);">Nothing found right now</span>
        </div>

      {:else}
        {#each newsFacts as fact, i (`${fact.url}-${i}`)}
        <a
          href={fact.url}
          target="_blank"
          rel="noopener noreferrer"
          class="ui-link-row"
        >
          <!-- Topic image -->
          <div style="width:44px;height:44px;border-radius:10px;overflow:hidden;flex-shrink:0;margin-top:1px;box-shadow:0 2px 8px rgba(0,0,0,0.25);">
            <img
              src={newsRowImage(fact.topic)}
              alt=""
              style="width:100%;height:100%;object-fit:cover;"
              loading="lazy"
              referrerpolicy="no-referrer"
            />
          </div>

          <!-- Fact text -->
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;color:var(--text);line-height:1.45;margin-bottom:4px;">{fact.fact}</div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:10px;font-weight:600;color:var(--text3);">{fact.source}</span>
              {#if fact.topic}
              <span class="ui-badge-pill" style="font-size:9px;padding:1px 6px;border-radius:4px;text-transform:none;letter-spacing:0;">{fact.topic}</span>
              {/if}
            </div>
          </div>

          <!-- Arrow -->
          <div style="color:var(--text3);font-size:12px;flex-shrink:0;margin-top:4px;">→</div>
        </a>
        {/each}
      {/if}

    </GlassPanel>
  </div>
  </DayReveal>
  {/if}

  <!-- ── GOOGLE: CALENDAR + INBOX ─────────────────────────────────────────── -->
  {#if $profile.googleConnected}
  <DayReveal>
  <div class="home-feed-pad">
    <GlassPanel r16 clip>

      <!-- Header -->
      <div class="ui-flex-header">
        <div class="home-cal-header-left">
          <div class="home-cal-icon" aria-hidden="true">📅</div>
          <div>
            <div class="ui-kicker-title" style="line-height:1.1;">Your Day</div>
            <div class="home-cal-date">{DATE_STR}</div>
          </div>
        </div>
        <button
          type="button"
          class="ui-icon-btn-ghost home-cal-refresh"
          on:click={() => {
            localStorage.removeItem(googleCacheKey('cal'));
            localStorage.removeItem(googleCacheKey('gmail'));
            calEvents = []; gmailBullets = [];
            loadCalendar(); loadGmail();
          }}
          aria-label="Refresh calendar and inbox"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M23 4v6h-6"/><path d="M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
        </button>
      </div>

      <!-- Calendar events -->
      {#if calLoading}
        <div style="padding:0 16px 12px;display:flex;flex-direction:column;gap:8px;">
          {#each [1,2] as _}<div class="skeleton" style="height:44px;border-radius:10px;"></div>{/each}
        </div>
      {:else if calError}
        <div class="ui-divider-top" style="padding:10px 16px 12px;display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:12px;color:var(--text3);">Couldn't load calendar</span>
          <button type="button" class="btn-pill-warn" on:click={loadCalendar}>Retry</button>
        </div>
      {:else if calEvents.filter(isToday).length === 0}
        <div class="ui-divider-top" style="padding:10px 16px 12px;font-size:12px;color:var(--text3);">No meetings today</div>
      {:else}
        <div class="home-cal-list ui-divider-top">
          {#each calEvents.filter(isToday) as ev (ev.id)}
          <div class="home-cal-row">
            <!-- Day pill -->
            <div class="home-cal-day-pill" class:home-cal-day-pill--today={isToday(ev)}>
              <div class="home-cal-day-name">{fmtEventDay(ev).split(' ')[0].toUpperCase()}</div>
              <div class="home-cal-day-time">{fmtEventTime(ev)}</div>
            </div>
            <!-- Event info -->
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{ev.title}</div>
              {#if ev.location}
              <div style="font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-top:1px;">📍 {ev.location}</div>
              {:else}
              <div style="font-size:11px;color:var(--text3);margin-top:1px;">{fmtEventDay(ev)}</div>
              {/if}
            </div>
            <!-- Push to calendar bell -->
            <button
              type="button"
              class="ui-icon-btn-ghost flex-shrink-0"
              on:click={() => pushReminderToCalendar(ev.title)}
              disabled={calendarPushLoading}
              aria-label="Set reminder"
            >🔔</button>
          </div>
          {/each}
        </div>
      {/if}

      <!-- Gmail inbox highlights -->
      {#if gmailLoading}
        <div class="ui-divider-top" style="padding:12px 16px;">
          <div class="skeleton" style="height:56px;border-radius:10px;"></div>
        </div>
      {:else if gmailBullets.length}
        <div class="ui-divider-top" style="padding:12px 16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;">
            <div class="home-gmail-ico" aria-hidden="true">✉️</div>
            <span style="font-size:11px;font-weight:700;color:var(--text2);letter-spacing:.2px;">Last 24hrs · Inbox</span>
          </div>
          {#each gmailBullets as bullet}
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;">
            <div style="width:4px;height:4px;border-radius:50%;background:var(--accent3);flex-shrink:0;margin-top:5px;"></div>
            <span style="font-size:12px;color:var(--text2);line-height:1.5;">{bullet}</span>
          </div>
          {/each}
          <button
            on:click={() => goto('/ai?q=summarise+my+emails+and+tell+me+what+needs+my+attention+today')}
            style="margin-top:8px;font-size:11px;font-weight:600;color:var(--accent3);background:none;border:none;cursor:pointer;padding:0;display:flex;align-items:center;gap:4px;"
          >Ask AI about inbox <span style="font-size:12px;">→</span></button>
        </div>
      {:else if gmailError || (!gmailLoading && !gmailBullets.length && $profile.googleIdentity?.emailThemes?.length)}
        <!-- Fallback: show analyzed email themes from identity if live fetch failed -->
        <div class="ui-divider-top" style="padding:12px 16px;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:9px;">
            <div class="home-gmail-ico" aria-hidden="true">✉️</div>
            <span style="font-size:11px;font-weight:700;color:var(--text2);">Inbox themes</span>
            {#if gmailError}<button on:click={loadGmail} style="font-size:10px;color:var(--accent3);background:none;border:none;cursor:pointer;margin-left:auto;">Refresh</button>{/if}
          </div>
          {#each ($profile.googleIdentity?.emailThemes ?? []) as theme}
          <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:6px;">
            <div style="width:4px;height:4px;border-radius:50%;background:var(--accent3);flex-shrink:0;margin-top:5px;"></div>
            <span style="font-size:12px;color:var(--text2);line-height:1.5;">{theme}</span>
          </div>
          {/each}
        </div>
      {/if}

    </GlassPanel>
  </div>
  </DayReveal>
  {/if}

  <!-- ── ✦ FOR YOU — primary feed ─────────────────────────────────────────── -->
  <DayReveal>
  <div style="margin-bottom:24px;">
    <div style="padding:0 20px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:15px;font-weight:700;">✦ For You</div>
        {#if recsMessage && !recsLoading}
        <div style="font-size:11px;color:var(--text2);margin-top:2px;line-height:1.4;">{recsMessage}</div>
        {/if}
      </div>
      <button on:click={() => goto('/ai?q=latest+picks+for+me+today')} style="font-size:11px;color:var(--accent3);background:none;border:none;cursor:pointer;">Ask AI →</button>
    </div>
    {#if recsLoading}
      <div style="display:flex;flex-direction:column;gap:10px;padding:0 20px;">
        {#each [1,2,3] as _}
        <div style="display:flex;gap:12px;align-items:center;background:rgba(255,255,255,0.04);border-radius:14px;padding:14px;border:1px solid rgba(255,255,255,0.06);">
          <div class="skeleton" style="width:104px;height:88px;border-radius:12px;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:6px;">
            <div class="skeleton" style="height:13px;border-radius:6px;width:80%;"></div>
            <div class="skeleton" style="height:11px;border-radius:6px;width:60%;"></div>
            <div class="skeleton" style="height:10px;border-radius:6px;width:40%;"></div>
          </div>
        </div>
        {/each}
      </div>
    {:else if recsError || recs.length === 0}
    <div style="padding:0 20px;">
      <div class="home-empty-panel ui-panel ui-panel--solid ui-panel--r14" style="padding:16px;">
        <span style="font-size:12px;color:var(--text2);">Couldn't load your picks right now</span>
        <button
          type="button"
          class="btn-pill-warn btn-pill-warn--lg flex-shrink-0"
          on:click={() => { localStorage.removeItem(todayKey('home_recs')); recs = []; recsError = false; loadRecs(); }}
        >↩ Retry</button>
      </div>
    </div>
    {:else}
    <!-- Info-rich card list — no external images, all content visible -->
    <div style="display:flex;flex-direction:column;gap:10px;padding:0 20px;">
      {#each recsDisplayed as card (card.title)}
      {@const pickThumb = card.image_url || suggestionHeroUrl(card.category, 360, 280)}
      <div
        class="home-rec-card"
        on:click={() => openCardUrl(card.url, card.title)}
        on:keydown={e => e.key === 'Enter' && openCardUrl(card.url, card.title)}
        role="button"
        tabindex="0"
      >
        <!-- Photo strip + category -->
        <div style="width:108px;min-height:96px;flex-shrink:0;position:relative;overflow:hidden;background:{cardGrad(card.category)};">
          <img
            src={pickThumb}
            alt=""
            style="width:100%;height:100%;min-height:96px;object-fit:cover;display:block;"
            referrerpolicy="no-referrer"
            loading="lazy"
            on:error={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              el.src = suggestionHeroUrl(card.category, 360, 280);
            }}
          />
          <div class="home-rec-media-scrim"></div>
          <div style="position:absolute;bottom:6px;left:6px;right:6px;display:flex;align-items:center;gap:4px;">
            <span style="font-size:14px;line-height:1;text-shadow:0 1px 4px rgba(0,0,0,0.8);">{card.emoji}</span>
            <span style="font-size:8px;font-weight:800;color:var(--text-on-media);text-transform:uppercase;letter-spacing:.4px;text-shadow:0 1px 3px rgba(0,0,0,0.9);">{card.category}</span>
          </div>
        </div>

        <!-- Right content -->
        <div style="flex:1;padding:12px 14px;display:flex;flex-direction:column;justify-content:space-between;min-width:0;gap:4px;">
          <!-- Title + match score -->
          <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px;">
            <div style="font-size:14px;font-weight:700;color:var(--text-primary);line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">{card.title}</div>
            <span
              class="home-rec-score"
              class:home-rec-score--high={card.match_score >= 90}
              class:home-rec-score--low={card.match_score < 90}
            >{card.match_score}%</span>
          </div>

          <!-- Description -->
          {#if card.description}
          <div style="font-size:12px;color:var(--text-secondary);line-height:1.4;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">{card.description}</div>
          {/if}

          <!-- Match reason + price + link -->
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:2px;">
            <div style="font-size:11px;color:var(--score-low-text);font-style:italic;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">✦ {card.match_reason}</div>
            <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
              {#if card.price}
              <span style="font-size:11px;font-weight:600;color:var(--text-secondary);">{card.price}</span>
              {/if}
              <span style="font-size:11px;font-weight:600;color:var(--score-low-text);">→</span>
            </div>
          </div>
        </div>
      </div>
      {/each}
    </div>
    {/if}
  </div>
  </DayReveal>

  <!-- Sentinel: when visible (or after idle), load tribe / videos / shop -->
  <div id="home-feed-lazy-sentinel" style="height:1px;margin:0;padding:0;" aria-hidden="true"></div>

  <!-- ── EVENTS & EXPERIENCES ──────────────────────────────────────────────── -->
  {#if recsLoading || eventsLoading || eventStripCards.length || eventsError}
  <div style="margin-bottom:24px;">
    <!-- Header -->
    <div style="padding:0 20px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:15px;font-weight:700;">🎟️ Events & Experiences</span>
          {#if !eventsLoading && !recsLoading && eventStripCards.length && eventListCards.length && !eventCards.length}
          <span class="ui-badge-pill">This month</span>
          {/if}
        </div>
        {#if eventsMessage && !eventsLoading && eventListCards.length && !eventCards.length}
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">{eventsMessage}</div>
        {/if}
      </div>
      <button on:click={() => goto(`/ai?q=${encodeURIComponent('events and experiences happening in ' + ($profile.instagramIdentity?.city ?? $profile.city ?? 'my city') + ' this month')}`)} style="font-size:11px;color:var(--accent3);background:none;border:none;cursor:pointer;">More →</button>
    </div>

    {#if (recsLoading || eventsLoading) && !eventStripCards.length}
      <!-- Skeleton -->
      <div style="display:flex;flex-direction:column;gap:8px;padding:0 20px;">
        {#each [1,2,3] as _}
        <div style="display:flex;gap:12px;align-items:center;background:rgba(255,255,255,0.04);border-radius:12px;padding:12px 14px;border:1px solid rgba(255,255,255,0.06);">
          <div class="skeleton" style="width:52px;height:52px;border-radius:12px;flex-shrink:0;"></div>
          <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
            <div class="skeleton" style="height:13px;border-radius:6px;width:75%;"></div>
            <div class="skeleton" style="height:11px;border-radius:6px;width:50%;"></div>
          </div>
          <div class="skeleton" style="width:50px;height:24px;border-radius:8px;flex-shrink:0;"></div>
        </div>
        {/each}
      </div>

    {:else if eventsError || eventStripCards.length === 0}
      <div style="padding:0 20px;">
        <div class="home-empty-panel ui-panel ui-panel--solid ui-panel--r12">
          <span style="font-size:12px;color:var(--text2);">No events found right now</span>
          <button
            type="button"
            class="btn-pill-warn btn-pill-warn--md"
            on:click={() => {
              localStorage.removeItem(todayKey('home_events'));
              localStorage.removeItem(todayKey('home_recs'));
              eventListCards = [];
              eventsError = false;
              eventsFallbackAttempted = false;
              loadRecs();
            }}
          >↩ Retry</button>
        </div>
      </div>

    {:else}
      <!-- Event cards — compact rows with platform source badge -->
      <div style="display:flex;flex-direction:column;gap:8px;padding:0 20px;">
        {#each eventStripCards as card (card.title)}
        {@const evThumb = card.image_url || suggestionHeroUrl(card.category || 'nightlife', 160, 160)}
        {@const platform = card.url?.includes('bookmyshow') ? 'BookMyShow'
          : card.url?.includes('district.in') ? 'District'
          : card.url?.includes('urbanaut') ? 'Urbanaut'
          : card.url?.includes('skillboxes') ? 'Skillboxes'
          : card.url?.includes('sortmyscene') ? 'SortMyScene'
          : 'Events'}
        {@const platformColor = card.url?.includes('bookmyshow') ? '#E5001A'
          : card.url?.includes('district.in') ? '#E23744'
          : card.url?.includes('urbanaut') ? '#6366F1'
          : card.url?.includes('skillboxes') ? '#0EA5E9'
          : '#10B981'}
        <div
          style="display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:12px;padding:12px 14px;cursor:pointer;transition:border-color .15s;"
          on:click={() => openCardUrl(card.url, card.title)}
          on:keydown={e => e.key === 'Enter' && openCardUrl(card.url, card.title)}
          on:mouseenter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)'}
          on:mouseleave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'}
          role="button"
          tabindex="0"
        >
          <!-- Thumbnail -->
          <div style="width:52px;height:52px;border-radius:12px;overflow:hidden;flex-shrink:0;position:relative;border:1px solid rgba(255,255,255,0.1);">
            <img
              src={evThumb}
              alt=""
              style="width:100%;height:100%;object-fit:cover;"
              referrerpolicy="no-referrer"
              loading="lazy"
              on:error={(e) => {
                (e.currentTarget as HTMLImageElement).src = suggestionHeroUrl('nightlife', 160, 160);
              }}
            />
            <span style="position:absolute;bottom:2px;right:2px;font-size:10px;line-height:1;text-shadow:0 1px 3px #000;">{card.emoji || '🎟️'}</span>
          </div>

          <!-- Info -->
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{card.title}</div>
            {#if card.description}
            <div style="font-size:11px;color:var(--text3);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">{card.description}</div>
            {/if}
          </div>

          <!-- Price + platform badge -->
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;flex-shrink:0;">
            {#if card.price}
            <span style="font-size:12px;font-weight:700;color:#fff;">{card.price}</span>
            {/if}
            <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:{platformColor}22;border:1px solid {platformColor}44;color:{platformColor};">{platform}</span>
          </div>
        </div>
        {/each}
      </div>
    {/if}
  </div>
  {/if}

  <!-- ── SHOP YOUR VIBE ────────────────────────────────────────────────────── -->
  {#if shopLoading || shopCards.length || shopError}
  <div style="margin-bottom:24px;">
    <!-- Header -->
    <div style="padding:0 20px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:15px;font-weight:700;">🛍️ Shop Your Vibe</span>
          {#if !shopLoading && shopCards.length}
          <span class="ui-badge-pill">For you</span>
          {/if}
        </div>
        {#if shopMessage && !shopLoading}
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">{shopMessage}</div>
        {/if}
      </div>
      <button on:click={() => goto(`/ai?q=${encodeURIComponent('find products that match my style and identity')}`)} style="font-size:11px;color:var(--accent3);background:none;border:none;cursor:pointer;">More →</button>
    </div>

    {#if shopLoading}
      <!-- Skeleton -->
      <div style="display:flex;gap:12px;padding:0 20px;overflow-x:auto;scrollbar-width:none;">
        {#each [1,2,3] as _}
        <div style="min-width:140px;flex-shrink:0;background:rgba(255,255,255,0.04);border-radius:14px;border:1px solid rgba(255,255,255,0.06);overflow:hidden;">
          <div class="skeleton" style="height:110px;width:100%;"></div>
          <div style="padding:10px;display:flex;flex-direction:column;gap:5px;">
            <div class="skeleton" style="height:12px;border-radius:6px;width:80%;"></div>
            <div class="skeleton" style="height:11px;border-radius:6px;width:50%;"></div>
            <div class="skeleton" style="height:10px;border-radius:6px;width:60%;"></div>
          </div>
        </div>
        {/each}
      </div>

    {:else if shopError || shopCards.length === 0}
      <div style="padding:0 20px;">
        <div class="home-empty-panel ui-panel ui-panel--solid ui-panel--r12">
          <span style="font-size:12px;color:var(--text2);">Couldn't find products right now</span>
          <button
            type="button"
            class="btn-pill-warn btn-pill-warn--md"
            on:click={() => { localStorage.removeItem(todayKey('home_shop')); shopCards = []; shopError = false; loadShop(); }}
          >↩ Retry</button>
        </div>
      </div>

    {:else}
      <!-- Product cards — horizontal scroll -->
      <div style="display:flex;gap:12px;padding:0 20px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:4px;">
        {#each shopCards as card (card.title)}
        {@const shopHero = card.image_url || suggestionHeroUrl(card.category || 'product', 400, 400)}
        {@const storeName = card.url?.includes('amazon') ? 'Amazon'
          : card.url?.includes('flipkart') ? 'Flipkart'
          : card.url?.includes('myntra') ? 'Myntra'
          : card.url?.includes('nykaa') ? 'Nykaa'
          : card.url?.includes('ajio') ? 'Ajio'
          : card.url?.includes('meesho') ? 'Meesho'
          : 'Shop'}
        {@const storeColor = card.url?.includes('amazon') ? '#FF9900'
          : card.url?.includes('flipkart') ? '#2874F0'
          : card.url?.includes('myntra') ? '#FF3F6C'
          : card.url?.includes('nykaa') ? '#FC2779'
          : card.url?.includes('ajio') ? '#1E3A5F'
          : '#10B981'}
        <div
          style="min-width:148px;max-width:148px;flex-shrink:0;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;cursor:pointer;transition:border-color .15s;opacity:{card.tier === 'low' ? 0.82 : 1};"
          on:click={() => openCardUrl(card.url, card.title)}
          on:keydown={e => e.key === 'Enter' && openCardUrl(card.url, card.title)}
          on:mouseenter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.16)'}
          on:mouseleave={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'}
          role="button"
          tabindex="0"
        >
          <!-- Image hero -->
          <div style="height:110px;position:relative;overflow:hidden;background:{cardGrad(card.category)};">
            <img
              src={shopHero}
              alt={card.title}
              style="width:100%;height:100%;object-fit:cover;display:block;"
              referrerpolicy="no-referrer"
              loading="lazy"
              on:error={(e) => {
                (e.currentTarget as HTMLImageElement).src = suggestionHeroUrl('product', 400, 400);
              }}
            />
            <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.35),transparent 60%);pointer-events:none;"></div>
            <span style="position:absolute;top:8px;right:8px;font-size:20px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.6));">{card.emoji || '🛍️'}</span>
          </div>

          <!-- Info -->
          <div style="padding:10px 10px 12px;">
            <div style="font-size:12px;font-weight:700;color:#fff;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.35;margin-bottom:5px;">{card.title}</div>
            {#if card.price}
            <div style="font-size:13px;font-weight:800;color:var(--text);margin-bottom:5px;">{card.price}</div>
            {/if}
            <span style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:{storeColor}22;border:1px solid {storeColor}44;color:{storeColor};">{storeName}</span>
            <div style="display:flex;gap:4px;margin-top:8px;align-items:center;" role="group">
              <button
                type="button"
                class="ui-icon-btn-ghost"
                style="padding:4px;opacity:0.85;"
                aria-label="This feels like me"
                on:click|stopPropagation={() =>
                  sendExpressionFeedback(`shop:${card.title}`, 'up', card.match_reason?.slice(0, 80))}
              ><ThumbsUp size={14} /></button>
              <button
                type="button"
                class="ui-icon-btn-ghost"
                style="padding:4px;opacity:0.85;"
                aria-label="Not quite"
                on:click|stopPropagation={() =>
                  sendExpressionFeedback(`shop:${card.title}`, 'down', card.match_reason?.slice(0, 80))}
              ><ThumbsDown size={14} /></button>
            </div>
          </div>
        </div>
        {/each}
      </div>
    {/if}
  </div>
  {/if}

  <!-- ── NEW MUSIC — only shows if music cards came back ───────────────────── -->
  {#if musicCards.length}
  <div style="margin-bottom:24px;">
    <div style="padding:0 20px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="font-size:15px;font-weight:700;">🎵 New music for you</div>
        {#if $profile.spotifyIdentity?.topArtists?.length}
        <div style="font-size:11px;color:var(--text3);margin-top:1px;">Based on your Spotify · {$profile.spotifyIdentity.topArtists.slice(0,2).join(', ')}</div>
        {:else if $profile.appleMusicIdentity?.topArtists?.length}
        <div style="font-size:11px;color:var(--text3);margin-top:1px;">Based on your Apple Music · {$profile.appleMusicIdentity.topArtists.slice(0, 2).join(', ')}</div>
        {:else if $profile.instagramIdentity?.musicVibe}
        <div style="font-size:11px;color:var(--text3);margin-top:1px;">Based on your vibe · {$profile.instagramIdentity.musicVibe}</div>
        {/if}
      </div>
      <button on:click={() => goto('/ai?q=latest+music+releases+I+would+love')} style="font-size:11px;color:var(--accent3);background:none;border:none;cursor:pointer;">More →</button>
    </div>
    <div class="h-scroll">{#each musicCards as card (card.title)}<ResultCard {card} tall />{/each}</div>
  </div>
  {/if}

  <!-- ── WATCH THIS — YouTube-style thumbnails ────────────────────────────── -->
  {#if videosLoading || videoCards.length || videosError}
  <div style="margin-bottom:24px;">
    <div style="padding:0 20px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:15px;font-weight:700;">Watch this</span>
          <span style="font-size:11px;font-weight:600;color:var(--text3);margin-left:6px;">YouTube picks</span>
          <!-- YouTube wordmark badge -->
          <div style="background:#FF0000;border-radius:4px;padding:2px 6px;display:inline-flex;align-items:center;gap:4px;">
            <svg width="12" height="9" viewBox="0 0 90 63" fill="white"><path d="M88.2 9.7a11.2 11.2 0 0 0-7.9-7.9C73.4 0 45 0 45 0S16.6 0 9.7 1.8A11.2 11.2 0 0 0 1.8 9.7C0 16.6 0 31.5 0 31.5s0 14.9 1.8 21.8a11.2 11.2 0 0 0 7.9 7.9C16.6 63 45 63 45 63s28.4 0 35.3-1.8a11.2 11.2 0 0 0 7.9-7.9C90 46.4 90 31.5 90 31.5S90 16.6 88.2 9.7z"/><polygon fill="white" points="36,45 59,31.5 36,18"/></svg>
            <span style="font-size:9px;font-weight:800;color:#fff;letter-spacing:.3px;">YouTube</span>
          </div>
        </div>
        {#if $profile.googleIdentity?.topChannels?.length}
        <div style="font-size:11px;color:var(--text3);margin-top:2px;">From your subscriptions</div>
        {/if}
      </div>
      <button on:click={() => goto('/ai?q=youtube+videos+I+would+love+right+now')} style="font-size:11px;color:var(--accent3);background:none;border:none;cursor:pointer;">More →</button>
    </div>

    {#if videosLoading}
      <!-- Skeleton: landscape 16:9 thumbnails -->
      <div style="display:flex;gap:12px;padding:0 20px;overflow:hidden;">
        {#each [1,2,3] as _}
        <div style="flex-shrink:0;width:220px;">
          <div class="skeleton" style="width:220px;height:124px;border-radius:10px;"></div>
          <div class="skeleton" style="height:13px;border-radius:6px;margin-top:8px;width:90%;"></div>
          <div class="skeleton" style="height:11px;border-radius:6px;margin-top:5px;width:60%;"></div>
        </div>
        {/each}
      </div>

    {:else if videosError || videoCards.length === 0}
      <div style="padding:0 20px;">
        <div class="home-empty-panel ui-panel ui-panel--solid ui-panel--r14">
          <span style="font-size:12px;color:var(--text2);">Couldn't load video picks</span>
          <button
            type="button"
            class="btn-pill-warn btn-pill-warn--lg flex-shrink-0"
            on:click={() => { localStorage.removeItem(todayKey('home_videos')); videoCards = []; videosError = false; loadVideos(); }}
          >↩ Retry</button>
        </div>
      </div>

    {:else}
      <!-- YouTube-style horizontal card row -->
      <div style="display:flex;gap:12px;overflow-x:auto;padding:0 20px 4px;scrollbar-width:none;">
        {#each videoCards as card (card.title)}
        {@const ytId = getYouTubeId(card.url)}
        {@const thumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null}
        {@const openVideo = () => {
          const url = card.url?.startsWith('http') ? card.url : `https://www.youtube.com/results?search_query=${encodeURIComponent(card.title)}`;
          window.open(url, '_blank', 'noopener,noreferrer');
        }}
        <div
          style="flex-shrink:0;width:220px;cursor:pointer;"
          on:click={openVideo}
          on:keydown={e => e.key === 'Enter' && openVideo()}
          role="button"
          tabindex="0"
        >
          <!-- Thumbnail -->
          <div style="position:relative;width:220px;height:124px;border-radius:10px;overflow:hidden;background:#1a1a1a;border:1px solid rgba(255,255,255,0.07);">
            {#if thumb}
              <img
                src={thumb}
                alt={card.title}
                style="width:100%;height:100%;object-fit:cover;display:block;"
                referrerpolicy="no-referrer"
                loading="lazy"
              />
            {:else}
              <div
                class="grad-video"
                style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:40px;background-image:linear-gradient(to top,rgba(0,0,0,0.5),transparent),url({suggestionHeroUrl('video', 640, 360)});background-size:cover;background-position:center;"
              >▶️</div>
            {/if}

            <!-- Gradient scrim at bottom -->
            <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,0.55) 0%,transparent 50%);pointer-events:none;"></div>

            <!-- Play button -->
            <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:40px;height:40px;border-radius:50%;background:rgba(0,0,0,0.72);backdrop-filter:blur(6px);border:1.5px solid rgba(255,255,255,0.3);display:flex;align-items:center;justify-content:center;pointer-events:none;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
            </div>

            <!-- Match score bottom-right -->
            <span style="position:absolute;bottom:7px;right:8px;font-size:9px;font-weight:700;padding:2px 5px;border-radius:4px;background:rgba(0,0,0,0.75);color:{card.match_score >= 90 ? '#00C27A' : '#FF4D60'};">{card.match_score}%</span>
          </div>

          <!-- Title + meta below thumbnail -->
          <div style="margin-top:7px;padding:0 2px;">
            <div style="font-size:13px;font-weight:600;color:var(--text);line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">
              {card.title}
            </div>
            {#if card.description}
            <div style="font-size:11px;color:var(--text3);margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              {card.description}
            </div>
            {/if}
          </div>
        </div>
        {/each}
      </div>
    {/if}
  </div>
  {/if}

  <!-- ── YOUR TRIBE ─────────────────────────────────────────────────────────── -->
  {#if tribeLoading || tribeCards.length}
  <div style="margin-bottom:24px;">
    <div style="padding:0 20px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:15px;font-weight:700;">🌍 Your tribe is into...</div>
      <button on:click={() => goto('/ai?q=what+people+with+my+vibe+are+loving+right+now')} style="font-size:11px;color:var(--accent3);background:none;border:none;cursor:pointer;">More →</button>
    </div>
    {#if tribeLoading}
    <div style="display:flex;gap:12px;padding:0 20px;overflow:hidden;">
      {#each [1,2,3] as _}<div class="skeleton" style="width:155px;height:225px;flex-shrink:0;border-radius:14px;"></div>{/each}
    </div>
    {:else}
    <div class="h-scroll">{#each tribeCards as card (card.title)}<ResultCard {card} tall />{/each}</div>
    {/if}
  </div>
  {/if}

  <!-- ── FOOD & DINING ──────────────────────────────────────────────────────── -->
  {#if foodCards.length && !recsLoading}
  <div style="margin-bottom:24px;">
    <div style="padding:0 20px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:15px;font-weight:700;">🍜 Food & Dining</div>
      <button on:click={() => goto(`/ai?q=${encodeURIComponent('best restaurant for me in ' + (city || 'my city'))}`)} style="font-size:11px;color:var(--accent3);background:none;border:none;cursor:pointer;">More →</button>
    </div>
    <div class="h-scroll">{#each foodCards as card (card.title)}<ResultCard {card} tall />{/each}</div>
  </div>
  {/if}

  <!-- ── STYLE & DROPS ──────────────────────────────────────────────────────── -->
  {#if recsShopCards.length && !recsLoading}
  <div style="margin-bottom:24px;">
    <div style="padding:0 20px;margin-bottom:10px;display:flex;align-items:center;justify-content:space-between;">
      <div style="font-size:15px;font-weight:700;">👗 Style & Drops</div>
      <button on:click={() => goto('/ai?q=latest+fashion+drops+and+deals+matching+my+style')} style="font-size:11px;color:var(--accent3);background:none;border:none;cursor:pointer;">More →</button>
    </div>
    <div class="h-scroll">{#each recsShopCards as card (card.title)}<ResultCard {card} tall />{/each}</div>
  </div>
  {/if}

  <!-- ── CONNECT MORE (if low completeness) ────────────────────────────────── -->
  {#if completeness < 60}
  <div style="padding:0 20px 24px;">
    <div class="home-connect-nudge ui-panel ui-panel--r14">
      <div style="font-size:13px;font-weight:700;margin-bottom:4px;">🧠 Your AI knows you {completeness}%</div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.5;">Connect more platforms and it learns your real taste — better music and picks.</div>
      <a href="/profile" class="home-connect-nudge__cta">
        Connect platforms
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="m9 18 6-6-6-6"/></svg>
      </a>
    </div>
  </div>
  {/if}

    <div class="home-bottom-spacer"></div>
    </div>
      </div>

    <aside class="home-chat-col" id="home-pa-anchor" aria-label="Ask your system">
      <div
        bind:this={homeChatScrollEl}
        class="home-chat-scroll home-chat-scroll--glass"
      >
        {#if homeChatMessages.length}
          <div class="home-chat-stack">
            {#each homeChatMessages as message}
              <div class="home-chat-turn">
                <div
                  class="home-chat-bubble"
                  class:home-chat-bubble--user={message.role === 'user'}
                  class:home-chat-bubble--shimmer={message.role === 'ai' && message.loading}
                >
                  {message.text}{#if message.loading}<span class="home-chat-caret">▍</span>{/if}
                </div>
                {#if message.role === 'ai' && message.cards?.length}
                  <div class="home-chat-cards">
                    {#each message.cards as card (card.title + card.url)}
                      <ResultCard {card} compact />
                    {/each}
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        {/if}

        <div class="home-composer-meta">
          <div class="home-chat-mode" role="tablist" aria-label="Composer mode">
            <button
              type="button"
              class="home-chat-mode__btn"
              class:home-chat-mode__btn--active={homeChatMode === 'ask'}
              role="tab"
              aria-selected={homeChatMode === 'ask'}
              on:click={() => (homeChatMode = 'ask')}
            >
              Chat
            </button>
            <button
              type="button"
              class="home-chat-mode__btn"
              class:home-chat-mode__btn--active={homeChatMode === 'learn'}
              role="tab"
              aria-selected={homeChatMode === 'learn'}
              on:click={() => (homeChatMode = 'learn')}
            >
              Teach portrait
            </button>
          </div>
          <div class="home-chat-col__head">
            <h2 class="home-chat-col__title">Ask your system</h2>
            <p class="chat-question-prompt">{chatColumnSubtitle}</p>
          </div>
          {#if homeChatStatus}
            <p class="home-chat-status">{homeChatStatus}</p>
          {/if}
        </div>
      </div>

      <div class="home-composer-panel">
        <div
          class="home-composer-inner"
          class:home-composer-inner--idle={!chatBusy && !paQuery.trim() && homeChatMode === 'ask'}
        >
          {#if isSpeechRecognitionSupported()}
            <button
              type="button"
              class="home-composer-mic"
              class:home-composer-mic--live={homeListening}
              title={homeListening ? 'Stop listening' : 'Voice input'}
              aria-label={homeListening ? 'Stop listening' : 'Voice input'}
              aria-pressed={homeListening}
              on:click={toggleListenHome}
            >
              <Mic size={22} strokeWidth={2} />
            </button>
          {/if}
          <textarea
            bind:this={paInputEl}
            bind:value={paQuery}
            on:keydown={handlePAKey}
            on:input={autoResizeHomePA}
            class="home-composer-input"
            rows="1"
            placeholder={composerPlaceholder}
            aria-label="Tell your system something to understand about you"
          ></textarea>
          <button
            type="button"
            class="home-composer-context"
            on:click={() => void ensureHomeContextLoadedAndScroll()}
            title="Add context from your feed and signals"
          >
            <Plus size={17} strokeWidth={2.25} />
            <span class="home-composer-context__txt">Context</span>
          </button>
          <button
            type="button"
            on:click={submitPA}
            disabled={!paQuery.trim() || chatBusy}
            aria-label="Send"
            title="Send"
            class="home-composer-send"
            class:home-composer-send--active={!!paQuery.trim()}
          >
            <Send size={18} strokeWidth={2.5} class="home-composer-send-ico" />
          </button>
        </div>
      </div>
    </aside>
  </div>
  </div>

{#if showShareModal && personaSnapshot}
  <ShareCardModal
    snapshot={personaSnapshot}
    photoUrl={photoUrl}
    on:close={() => (showShareModal = false)}
  />
{/if}

</div>

<style>
  /* ─── Persona-first layout ─────────────────────────────────────────────── */

  .home-page-root {
    position: relative;
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    height: 100%;
    overflow: hidden;
    /* Aurora + PersonaBg show through; avoid a flat --bg slab */
    background: transparent;
  }

  .home-aurora {
    position: fixed;
    inset: 0;
    z-index: 0;
    pointer-events: none;
    background:
      radial-gradient(ellipse 85% 55% at 50% -15%, rgba(196, 242, 74, 0.07) 0%, transparent 55%),
      radial-gradient(ellipse 65% 45% at 100% 5%, rgba(59, 130, 246, 0.08) 0%, transparent 48%),
      radial-gradient(ellipse 55% 40% at 0% 100%, rgba(168, 85, 247, 0.05) 0%, transparent 50%);
    mix-blend-mode: screen;
    opacity: 0.75;
  }

  .home-shell {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding-inline: max(var(--home-layout-gutter), env(safe-area-inset-left, 0px))
      max(var(--home-layout-gutter), env(safe-area-inset-right, 0px));
    padding-top: 8px;
    position: relative;
    z-index: 1;
  }

  @media (min-width: 1024px) {
    /* Sidebar–main gap comes from `.app-shell--rail` flex gap; keep only safe-area + right edge inset */
    .home-shell {
      padding-left: max(0px, env(safe-area-inset-left, 0px));
      padding-right: max(var(--home-layout-gutter), env(safe-area-inset-right, 0px));
      padding-top: max(12px, var(--home-layout-gutter));
    }
  }

  .home-deep-persona__title {
    font-size: var(--home-font-section, 14px);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 16px;
  }

  @media (prefers-reduced-motion: no-preference) {
    .home-aurora--breathe {
      animation: home-aurora-drift 22s ease-in-out infinite alternate;
    }
  }

  @keyframes home-aurora-drift {
    from {
      opacity: 0.82;
      transform: scale(1);
    }
    to {
      opacity: 1;
      transform: scale(1.03);
    }
  }

  .home-split {
    flex: 1;
    min-height: 0;
    width: 100%;
    max-width: none;
    margin: 0;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: minmax(0, 1fr) minmax(220px, auto);
    position: relative;
    z-index: 1;
    gap: var(--home-section-gap, 32px);
  }

  @media (min-width: 1024px) {
    .home-split {
      /* Identity feed + chat only; FloatingNav covers primary nav */
      grid-template-columns: minmax(0, 1fr) minmax(0, 35%);
      grid-template-rows: minmax(0, 1fr);
      gap: 0 var(--home-layout-gutter);
      align-items: stretch;
    }
  }

  @media (max-width: 1023px) {
    .home-chat-col {
      order: 2;
    }
  }

  .home-identity-col {
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: color-mix(in srgb, var(--glass-light) 84%, transparent);
    border: 1px solid var(--panel-border);
    border-radius: 20px;
    box-shadow: var(--shadow-tall-card);
  }

  .home-chat-col {
    display: flex;
    flex-direction: column;
    min-height: 0;
    z-index: 40;
    background: color-mix(in srgb, var(--glass-light) 88%, transparent);
    backdrop-filter: blur(18px) saturate(1.06);
    -webkit-backdrop-filter: blur(18px) saturate(1.06);
    border-top: 1px solid var(--panel-border);
    border-radius: 20px;
  }

  @media (min-width: 1024px) {
    .home-chat-col {
      border-top: none;
      border: 1px solid var(--panel-border);
      max-height: none;
      align-items: flex-end;
    }

    .home-chat-scroll {
      align-items: flex-end;
      text-align: right;
      width: 100%;
    }

    .home-chat-col__head {
      text-align: right;
      width: 100%;
    }

    .home-chat-status {
      text-align: right;
      width: 100%;
    }

    .home-composer-panel {
      width: 100%;
      display: flex;
      justify-content: flex-end;
    }

    .home-composer-inner {
      max-width: 100%;
      justify-content: flex-end;
    }
  }

  .home-chat-scroll--glass {
    border-radius: 18px 18px 0 0;
  }

  .home-chat-col__head {
    margin-bottom: 4px;
  }

  .home-chat-col__title {
    margin: 0 0 8px;
    font-size: var(--home-font-section, 15px);
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--text-primary);
  }

  .home-profile-module--flat {
    margin-bottom: var(--home-section-gap, 32px);
  }

  @media (min-width: 1024px) {
    .home-profile-module--flat {
      margin-bottom: var(--home-section-gap-lg, 48px);
    }
  }

  .home-signal-strip {
    display: flex;
    gap: var(--home-layout-gutter);
    overflow-x: auto;
    overflow-y: hidden;
    padding: 4px 2px 12px;
    scroll-snap-type: x proximity;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: thin;
  }

  @media (min-width: 1024px) {
    .home-signal-strip {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: var(--home-layout-gutter);
      overflow-x: visible;
      padding: 0 0 12px;
    }
  }

  .home-signal-mod {
    flex: 0 0 min(240px, 72vw);
    scroll-snap-align: start;
    border-radius: 16px;
    border: 1px solid var(--panel-border);
    background: var(--bg-elevated);
    padding: 12px 14px;
    transition:
      transform 0.15s ease,
      border-color 0.15s ease;
  }

  @media (min-width: 1024px) {
    .home-signal-mod {
      flex: unset;
      min-width: 0;
    }
  }

  .home-signal-mod:hover {
    transform: translateY(-2px);
    border-color: var(--panel-hover-border);
  }

  .home-signal-mod__ico {
    color: var(--accent-primary);
    margin-bottom: 8px;
  }

  .home-signal-mod__src {
    margin: 0 0 4px;
    font-size: var(--home-font-meta, 11px);
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .home-signal-mod__read {
    margin: 0 0 10px;
    font-size: var(--home-font-body, 13px);
    line-height: 1.5;
    color: var(--text-secondary);
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .home-signal-mod__meter {
    height: 3px;
    border-radius: 99px;
    background: var(--panel-surface);
    overflow: hidden;
  }

  .home-signal-mod__meter-fill {
    display: block;
    height: 100%;
    border-radius: 99px;
    background: var(--home-accent-gradient, linear-gradient(90deg, #c4f24a, #22d3ee));
  }

  @media (prefers-reduced-motion: no-preference) {
    .home-signal-mod__meter-fill {
      animation: home-signal-meter-in 0.85s ease-out both;
    }
  }

  @keyframes home-signal-meter-in {
    from {
      transform: scaleX(0.2);
      transform-origin: left;
    }
    to {
      transform: scaleX(1);
    }
  }

  .home-composer-context {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 12px;
    height: 40px;
    border-radius: 999px;
    border: 1px solid var(--panel-border);
    background: var(--panel-surface-soft);
    color: var(--text-secondary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .home-composer-context:hover {
    background: var(--panel-hover);
    border-color: var(--panel-hover-border);
    color: var(--text-primary);
  }

  @media (max-width: 520px) {
    .home-composer-context__txt {
      display: none;
    }
    .home-composer-context {
      padding: 0 10px;
    }
  }

  .home-chat-bubble--shimmer {
    background: linear-gradient(
      90deg,
      var(--glass-medium) 0%,
      color-mix(in srgb, var(--accent-soft) 35%, var(--glass-medium)) 50%,
      var(--glass-medium) 100%
    );
    background-size: 200% 100%;
  }

  @media (prefers-reduced-motion: no-preference) {
    .home-chat-bubble--shimmer {
      animation: home-chat-shimmer 1.2s ease-in-out infinite;
    }
  }

  @keyframes home-chat-shimmer {
    0% {
      background-position: 100% 0;
    }
    100% {
      background-position: -100% 0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .home-chat-bubble--shimmer {
      animation: none !important;
      background: var(--glass-medium);
    }
  }

  @media (max-width: 1023px) {
    .home-chat-col {
      max-height: min(48vh, 440px);
      min-height: 200px;
    }
  }

  .home-chat-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 12px 12px 4px;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
  }

  .home-chat-scroll::-webkit-scrollbar {
    display: none;
  }

  .home-composer-panel {
    flex-shrink: 0;
    padding: 8px 12px max(12px, env(safe-area-inset-bottom));
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--bg-primary) 96%, transparent) 0%,
      color-mix(in srgb, var(--bg-primary) 88%, transparent) 100%
    );
    border-top: 1px solid var(--panel-border);
    pointer-events: auto;
  }

  @media (max-width: 1023px) {
    .home-composer-panel {
      padding-bottom: max(12px, calc(56px + env(safe-area-inset-bottom, 0px)));
    }
  }

  .home-persona-scroll {
    position: relative;
    z-index: 1;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding-bottom: max(12px, calc(12px + env(safe-area-inset-bottom, 0px)));
  }

  .home-persona-scroll::-webkit-scrollbar {
    display: none;
  }

  .home-profile-module {
    max-width: none;
    margin: 0 0 18px;
    width: 100%;
    padding: 0 var(--home-layout-gutter);
    animation: home-section-in 420ms ease both;
  }

  .home-profile-module:nth-of-type(2) { animation-delay: 70ms; }
  .home-profile-module:nth-of-type(3) { animation-delay: 120ms; }
  .home-profile-module:nth-of-type(4) { animation-delay: 170ms; }

  @keyframes home-section-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .home-profile-module {
      animation: none !important;
      opacity: 1;
    }

    .home-aurora--breathe {
      animation: none !important;
    }
  }

  .home-how-card {
    background: var(--glass-light);
    border: 1px solid var(--panel-border);
    border-radius: 20px;
    box-shadow: var(--shadow-tall-card);
    padding: 18px 18px 16px;
  }

  .home-how-kicker {
    margin: 0 0 10px;
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--accent-primary);
  }

  .home-how-kicker--spaced {
    margin-top: 18px;
  }

  .home-how-line {
    margin: 12px 0 0;
    font-size: 0.88rem;
    color: var(--text-secondary);
    line-height: 1.6;
  }

  .home-how-line:first-of-type {
    margin-top: 8px;
  }

  .home-how-key {
    font-style: normal;
    font-weight: 600;
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-right: 8px;
  }

  .home-how-key--tension {
    margin: 0 0 8px;
    display: inline-block;
  }

  .home-tension-glow {
    margin-top: 14px;
    padding: 13px 14px;
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--accent-primary) 22%, var(--panel-border));
    background:
      linear-gradient(130deg, rgba(196, 242, 74, 0.1) 0%, rgba(59, 130, 246, 0.09) 45%, rgba(168, 85, 247, 0.1) 100%),
      var(--glass-light);
  }

  .home-tension-line {
    margin: 0;
    font-size: 0.9rem;
    font-weight: 500;
    color: color-mix(in srgb, var(--text-primary) 86%, var(--accent-secondary));
    line-height: 1.5;
  }

  .home-tension-sep {
    color: var(--accent-primary);
    opacity: 0.8;
  }

  .home-cluster-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 4px;
  }

  .home-cluster-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 8px;
  }

  .home-cluster-theme {
    font-size: 0.88rem;
    font-weight: 600;
    color: var(--text-primary);
    line-height: 1.3;
  }

  .home-cluster-meter {
    flex-shrink: 0;
    width: 56px;
    height: 4px;
    border-radius: 99px;
    background: var(--panel-surface);
    overflow: hidden;
  }

  .home-cluster-meter-fill {
    display: block;
    height: 100%;
    border-radius: 99px;
    background: linear-gradient(90deg, var(--accent-primary), color-mix(in srgb, var(--accent-primary) 60%, #fff));
  }

  .home-cluster-signals {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .home-cluster-pill {
    font-size: 0.68rem;
    font-weight: 600;
    padding: 4px 10px;
    border-radius: 999px;
    background: var(--panel-surface-soft);
    border: 1px solid var(--panel-border);
    color: var(--text-secondary);
  }

  .home-signal-meter-list {
    list-style: none;
    margin: 0;
    padding: 0;
    border-radius: 14px;
    border: 1px solid var(--panel-border);
    background: var(--glass-light);
    overflow: hidden;
  }

  .home-signal-meter-row {
    display: grid;
    grid-template-columns: minmax(0, 0.28fr) minmax(0, 1fr) auto;
    gap: 8px 10px;
    align-items: baseline;
    padding: 10px 12px;
    border-bottom: 1px solid var(--panel-divider);
    font-size: 0.82rem;
  }

  .home-signal-meter-row:last-child {
    border-bottom: none;
  }

  .home-signal-meter-cat {
    font-size: 0.62rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent-primary);
  }

  .home-signal-meter-val {
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .home-signal-meter-score {
    font-size: 0.72rem;
    font-variant-numeric: tabular-nums;
    color: var(--text-muted);
    opacity: 0.75;
  }

  .home-primary-label {
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent-primary);
    margin-bottom: 10px;
  }

  .home-hyper-block {
    border-radius: 16px;
    border: 1px solid var(--panel-border);
    background: var(--glass-light);
    padding: 14px 14px 12px;
  }

  .home-hyper-taste {
    margin: 0 0 10px;
    font-size: 0.88rem;
    line-height: 1.45;
    color: var(--text-secondary);
  }

  .home-hyper-intent {
    margin: 0 0 10px;
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--text-muted);
  }

  .home-hyper-next {
    margin: 0 0 10px;
    font-size: 0.84rem;
    line-height: 1.45;
    color: var(--text-secondary);
  }

  .home-hyper-tag {
    display: inline-block;
    margin-right: 8px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--accent-secondary);
  }

  .home-hyper-insights {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.82rem;
    line-height: 1.45;
    color: var(--text-secondary);
  }

  .home-hyper-insights li {
    margin-bottom: 6px;
  }

  /* Deep view expand button */
  .deep-view-cta-wrap {
    display: flex;
    justify-content: center;
    padding: 12px 20px 24px;
  }

  .deep-view-btn {
    background: var(--glass-light);
    border: 1px dashed var(--panel-border-strong);
    border-radius: 100px;
    color: var(--text-muted);
    font-size: 0.80rem;
    font-weight: 500;
    padding: 10px 22px;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
    letter-spacing: 0.04em;
  }

  .deep-view-btn:hover {
    background: var(--panel-hover);
    color: var(--text-secondary);
  }

  /* Legacy host: non-Home surfaces still use default panel Tailwind; Home uses variant=home (no overrides). */
  .home-earn-panel-host {
    border-radius: 20px;
    overflow: hidden;
    border: 1px solid var(--panel-border);
    background: var(--glass-light);
  }

  .home-earn-panel-host--flush {
    border: none;
    background: transparent;
    box-shadow: none;
    border-radius: 0;
    overflow: visible;
  }

  .home-more-about {
    padding-bottom: 4px;
  }

  .home-context-anchor {
    height: 1px;
    margin: 0;
    padding: 0;
    scroll-margin-top: 72px;
  }

  /* ─── Original feed styles (unchanged below) ───────────────────────────── */

  .home-feed-pad {
    padding: 0 var(--home-layout-gutter) var(--home-layout-gutter);
  }

  .home-cal-header-left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .home-cal-icon {
    width: 32px;
    height: 32px;
    border-radius: 9px;
    background: linear-gradient(135deg, #4285f4, #34a853);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
  }

  .home-cal-date {
    font-size: 10px;
    color: var(--text3);
  }

  .home-news-skel-row {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 10px 16px;
  }

  .home-rec-card {
    display: flex;
    gap: 0;
    background: var(--panel-surface);
    border: 1px solid var(--panel-border);
    border-radius: 16px;
    overflow: hidden;
    cursor: pointer;
    transition:
      transform 0.15s ease,
      border-color 0.15s ease;
  }

  .home-rec-card:hover {
    border-color: var(--panel-hover-border);
    transform: scale(1.01);
  }

  .home-rec-media-scrim {
    position: absolute;
    inset: 0;
    background: var(--scrim-media);
    pointer-events: none;
  }

  .home-rec-score {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 6px;
  }

  .home-rec-score--high {
    background: var(--score-high-bg);
    color: var(--score-high-text);
    border: 1px solid var(--score-high-border);
  }

  .home-rec-score--low {
    background: var(--score-low-bg);
    color: var(--score-low-text);
    border: 1px solid var(--score-low-border);
  }

  .home-rec-card:focus-visible {
    outline: 2px solid var(--accent-primary);
    outline-offset: 2px;
  }

  .home-cal-list {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .home-cal-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 16px;
  }

  .home-cal-day-pill {
    flex-shrink: 0;
    width: 42px;
    text-align: center;
    background: var(--panel-surface);
    border: 1px solid var(--panel-border);
    border-radius: 8px;
    padding: 4px 2px;
  }

  .home-cal-day-pill--today {
    background: var(--calendar-today-bg);
    border-color: var(--calendar-today-border);
  }

  .home-cal-day-name {
    font-size: 9px;
    font-weight: 700;
    color: var(--text3);
  }

  .home-cal-day-pill--today .home-cal-day-name {
    color: var(--calendar-today-label);
  }

  .home-cal-day-time {
    font-size: 11px;
    font-weight: 700;
    color: var(--text2);
  }

  .home-cal-day-pill--today .home-cal-day-time {
    color: var(--calendar-today-label);
  }

  .home-gmail-ico {
    width: 20px;
    height: 20px;
    border-radius: 5px;
    background: var(--gmail-icon-bg);
    border: 1px solid var(--gmail-icon-border);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
  }

  .home-empty-panel {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px;
  }

  .home-connect-nudge {
    padding: 16px;
    background: linear-gradient(
      135deg,
      var(--brand-red-soft),
      color-mix(in srgb, var(--brand-red) 6%, transparent)
    );
    border-color: var(--pill-warn-border);
  }

  .home-connect-nudge__cta {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    font-weight: 700;
    color: var(--accent-tertiary);
    background: var(--brand-red-soft);
    border: 1px solid var(--pill-warn-border);
    padding: 8px 16px;
    border-radius: 100px;
    text-decoration: none;
    transition: opacity 0.15s ease;
  }

  .home-connect-nudge__cta:hover {
    opacity: 0.9;
  }

  .home-bottom-spacer {
    height: max(100px, env(safe-area-inset-bottom, 0px));
  }

  @media (min-width: 1024px) {
    .home-bottom-spacer {
      height: max(72px, env(safe-area-inset-bottom, 0px));
    }
  }

  .home-below {
    position: relative;
    z-index: 1;
    background: color-mix(in srgb, var(--glass-light) 72%, transparent);
    backdrop-filter: blur(14px) saturate(1.05);
    -webkit-backdrop-filter: blur(14px) saturate(1.05);
    border-top: 1px solid color-mix(in srgb, var(--panel-border) 85%, transparent);
  }

  .home-below-sheet {
    padding: 20px 0 8px;
    border-radius: 22px 22px 0 0;
    margin-top: -18px;
    background: color-mix(in srgb, var(--glass-light) 78%, transparent);
    backdrop-filter: blur(16px) saturate(1.06);
    -webkit-backdrop-filter: blur(16px) saturate(1.06);
    border: 1px solid color-mix(in srgb, var(--panel-border) 80%, transparent);
    border-bottom: none;
    box-shadow: 0 -8px 36px rgba(0, 0, 0, 0.22);
  }

  .home-below-sheet--expanded {
    margin-top: 0;
    border-radius: 0;
    border-left: none;
    border-right: none;
    box-shadow: none;
    padding-top: 12px;
  }

  .home-knows-bar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px 4px;
    font-size: 11px;
    color: var(--text3);
  }

  .home-knows-pct {
    font-weight: 700;
  }

  .home-knows-track {
    height: 3px;
    background: var(--panel-divider);
    border-radius: 2px;
    margin: 0 20px 16px;
    overflow: hidden;
  }

  .home-knows-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.5s ease;
  }

  .home-unified-deck {
    margin-bottom: 18px;
    padding: 16px 18px 18px;
    background: color-mix(in srgb, var(--glass-light) 94%, transparent);
    border: 1px solid var(--panel-border);
    border-radius: 20px;
    box-shadow: var(--shadow-tall-card);
  }

  .home-unified-deck .home-deep-persona__title {
    margin-bottom: 12px;
  }

  .twin-deck {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }

  @media (min-width: 640px) {
    .twin-deck {
      grid-template-columns: repeat(4, 1fr);
    }
  }

  .twin-deck--unified .twin-deck-btn {
    background: color-mix(in srgb, var(--bg-elevated) 85%, transparent);
  }

  .twin-deck-btn {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 12px 12px 14px;
    border-radius: 16px;
    border: 1px solid var(--panel-border);
    background: var(--panel-surface);
    color: var(--text);
    cursor: pointer;
    text-align: left;
    min-height: 88px;
    -webkit-tap-highlight-color: transparent;
    transition: border-color 0.15s ease, background 0.15s ease;
  }

  .twin-deck-btn:active {
    background: var(--panel-hover);
  }

  .twin-deck-ico {
    font-size: 16px;
  }

  .twin-deck-title {
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.35em;
    text-transform: uppercase;
    color: var(--text3);
  }

  .twin-deck-stat {
    font-size: 11px;
    color: var(--text2);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .home-live-signals-pad {
    padding-bottom: 8px;
  }

  .home-live-signals--stacked {
    padding: 0 0 12px;
    margin-bottom: 6px;
  }

  .home-live-signals--stacked :global(.ui-kicker-title) {
    font-size: var(--home-font-section, 14px);
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .home-live-signals--stacked :global(.ui-kicker-sub) {
    color: var(--text-muted);
    opacity: 0.88;
  }

  .home-live-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px 0;
  }

  .home-live-profile-link {
    font-size: 12px;
    font-weight: 600;
    color: var(--accent-primary);
    text-decoration: none;
    flex-shrink: 0;
  }

  .home-live-profile-link:hover {
    text-decoration: underline;
  }

  .home-live-block {
    padding: 12px 16px 14px;
  }

  .home-live-label {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 8px;
  }

  .home-live-line {
    margin: 0 0 6px;
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.45;
  }

  .home-live-meta {
    margin: 0 0 6px;
    font-size: 12px;
    color: var(--text-muted);
  }

  .home-live-hint {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--text-secondary);
    font-style: italic;
    line-height: 1.4;
  }

  .home-live-hint-stack {
    margin-top: 8px;
  }

  .home-live-hint-stack--infer {
    margin-top: 10px;
    padding-top: 10px;
  }

  .home-live-source-tag {
    display: inline-block;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text3);
    margin-bottom: 2px;
  }

  .home-signals-meta {
    margin: -4px 0 8px;
    font-size: 10px;
    color: var(--text3);
    letter-spacing: 0.04em;
  }

  .home-signals-patterns {
    margin: 0 0 12px;
    font-size: 11px;
    line-height: 1.45;
    color: var(--text-muted);
  }

  .home-live-footnote {
    margin: 8px 0 0;
    font-size: 11px;
    color: var(--text-muted);
    line-height: 1.4;
  }

  .home-live-list {
    margin: 0;
    padding-left: 1.1rem;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.45;
  }

  .home-live-am-tracks {
    margin: 4px 0 10px;
  }

  .home-live-ig-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 8px;
  }

  .home-live-ig-thumb-wrap {
    flex: 1;
    min-width: 72px;
    max-width: 100px;
    text-decoration: none;
    color: inherit;
  }

  .home-live-ig-thumb {
    width: 100%;
    aspect-ratio: 1;
    object-fit: cover;
    border-radius: 10px;
    border: 1px solid var(--panel-border);
    display: block;
  }

  .home-live-ig-thumb--empty {
    background: var(--panel-surface);
  }

  .home-live-ig-cap {
    display: block;
    font-size: 10px;
    color: var(--text-muted);
    margin-top: 4px;
    line-height: 1.3;
  }

  .home-live-ig-stat {
    display: block;
    font-size: 10px;
    color: var(--text-secondary);
    margin-top: 2px;
  }

  .home-live-comment-list {
    margin: 6px 0 0;
    padding-left: 0;
    list-style: none;
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
  }

  .home-live-comment-list li {
    margin-bottom: 6px;
  }

  .home-live-c-user {
    font-weight: 600;
    color: var(--text-primary);
    margin-right: 4px;
  }

  .home-chat-stack {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 4px 8px;
  }

  .home-chat-turn {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  .home-chat-cards {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    max-width: 100%;
  }

  .home-chat-bubble {
    align-self: flex-start;
    max-width: 100%;
    padding: 10px 14px;
    border-radius: 16px;
    background: var(--glass-medium);
    border: 1px solid var(--panel-border);
    color: var(--text-secondary);
    backdrop-filter: blur(16px) saturate(1.15);
    -webkit-backdrop-filter: blur(16px) saturate(1.15);
    font-size: 0.8rem;
    line-height: 1.45;
    box-shadow: 0 8px 26px rgba(0, 0, 0, 0.35);
    animation: home-thought-in 280ms ease both;
  }

  .home-chat-bubble--user {
    align-self: flex-end;
    background: color-mix(in srgb, var(--accent-soft) 62%, var(--glass-medium));
    color: var(--text-primary);
  }

  @keyframes home-thought-in {
    from {
      opacity: 0;
      transform: translateY(6px);
      filter: blur(3px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
      filter: blur(0);
    }
  }

  .home-chat-caret {
    margin-left: 2px;
    color: rgba(255, 255, 255, 0.55);
    animation: home-chat-blink 1s step-end infinite;
  }

  @keyframes home-chat-blink {
    50% { opacity: 0; }
  }

  .home-composer-meta {
    padding: 0 8px;
  }

  .home-chat-mode {
    display: flex;
    gap: 6px;
    margin-bottom: 12px;
  }

  .home-chat-mode__btn {
    flex: 1;
    min-width: 0;
    padding: 7px 10px;
    border-radius: 10px;
    font-size: 0.72rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    border: 1px solid var(--panel-border);
    background: color-mix(in srgb, var(--glass-light) 60%, transparent);
    color: var(--text-muted);
    cursor: pointer;
    transition:
      background 0.15s ease,
      border-color 0.15s ease,
      color 0.15s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .home-chat-mode__btn:hover {
    border-color: var(--panel-hover-border);
    color: var(--text-secondary);
  }

  .home-chat-mode__btn--active {
    background: color-mix(in srgb, var(--accent-soft) 55%, var(--glass-light));
    border-color: color-mix(in srgb, var(--accent-primary) 28%, var(--panel-border));
    color: var(--text-primary);
  }

  .chat-question-prompt,
  .home-chat-status {
    margin: 0;
    font-size: 0.78rem;
    line-height: 1.4;
  }

  .chat-question-prompt {
    color: var(--text-muted);
    font-style: italic;
  }

  .home-chat-status {
    color: var(--text-muted);
    margin-top: 4px;
    text-transform: lowercase;
  }

  .home-composer-inner {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 8px 8px 12px;
    background: color-mix(in srgb, var(--bg-elevated) 78%, var(--glass-medium));
    backdrop-filter: blur(18px) saturate(1.05);
    -webkit-backdrop-filter: blur(18px) saturate(1.05);
    border: 1px solid var(--panel-border-strong);
    border-radius: 16px;
    box-shadow:
      0 8px 22px rgba(0, 0, 0, 0.32),
      0 1px 0 rgba(255, 255, 255, 0.07) inset;
    transition:
      border-color 0.35s ease,
      box-shadow 0.35s ease,
      background 0.35s ease;
  }

  .home-composer-inner--idle {
    animation: home-composer-breathe 2.4s ease-in-out infinite;
  }

  @keyframes home-composer-breathe {
    0%, 100% {
      box-shadow:
        0 12px 32px rgba(0, 0, 0, 0.42),
        0 1px 0 rgba(255, 255, 255, 0.07) inset;
      border-color: var(--panel-border-strong);
    }
    50% {
      box-shadow:
        0 14px 38px rgba(0, 0, 0, 0.48),
        0 0 0 2px color-mix(in srgb, var(--accent-primary) 14%, transparent),
        0 1px 0 rgba(255, 255, 255, 0.09) inset;
      border-color: color-mix(in srgb, var(--accent-primary) 35%, var(--panel-border-strong));
    }
  }

  .home-composer-mic {
    width: 36px;
    height: 36px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 1px solid var(--border-subtle);
    background: var(--panel-hover);
    color: var(--text-primary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
    -webkit-tap-highlight-color: transparent;
  }

  .home-composer-mic--live {
    background: color-mix(in srgb, var(--accent-primary) 22%, var(--glass-light));
    border-color: color-mix(in srgb, var(--accent-primary) 40%, var(--border-subtle));
    color: var(--accent-primary);
    box-shadow:
      0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent),
      0 0 28px color-mix(in srgb, var(--accent-primary) 28%, transparent);
    animation: home-mic-pulse 1.1s ease-in-out infinite;
  }

  @keyframes home-mic-pulse {
    0%,
    100% {
      box-shadow:
        0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent),
        0 0 20px color-mix(in srgb, var(--accent-primary) 22%, transparent);
    }
    50% {
      box-shadow:
        0 0 0 5px color-mix(in srgb, var(--accent-primary) 25%, transparent),
        0 0 36px color-mix(in srgb, var(--accent-primary) 32%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .home-composer-mic--live {
      animation: none;
    }

    .home-composer-inner--idle {
      animation: none;
    }

    .home-chat-bubble {
      animation: none;
    }
  }

  .home-composer-input {
    flex: 1;
    min-width: 0;
    min-height: 36px;
    max-height: 120px;
    resize: none;
    background: transparent;
    border: none;
    outline: none;
    font-size: 14px;
    line-height: 1.45;
    color: var(--text);
    caret-color: var(--accent-primary);
    padding: 6px 4px 6px 0;
    font-family: inherit;
  }

  .home-composer-input::placeholder {
    color: var(--text3);
  }

  .home-composer-send {
    width: 38px;
    height: 38px;
    flex-shrink: 0;
    border-radius: 50%;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    background: color-mix(in srgb, var(--panel-surface) 82%, var(--bg-elevated));
    color: var(--text-muted);
    cursor: default;
    transition: background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
  }

  .home-composer-send--active {
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    color: #0c0e12;
    cursor: pointer;
    box-shadow: 0 4px 22px color-mix(in srgb, var(--accent-primary) 42%, transparent);
  }

  .home-composer-send--active:active {
    transform: scale(0.96);
  }

  .home-composer-send--active :global(.home-composer-send-ico) {
    color: #0c0e12;
  }
</style>
