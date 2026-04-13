<script lang="ts">
  import { tick, onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { profile } from '$lib/stores/profile';
  import { reminders } from '$lib/stores/reminders';
  import ResultCard from '$lib/components/ResultCard.svelte';
  import TwinPresence from '$lib/components/TwinPresence.svelte';
  import TwinHeroBlob from '$lib/components/home/TwinHeroBlob.svelte';
  import type { ResultCard as Card } from '$lib/utils';
  import type { TwinChatAction } from '$lib/utils';
  import { buildTwinStarters } from '$lib/prompts/twinStarters';
  import { ensureMatchReason } from '$lib/utils/matchReason';
  import { getCurrentContext } from '$lib/stores/contextStore';
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
    loadTwinMemory,
    saveTwinMemory,
    mergeLearnings,
    shouldLearn,
    memoryKeyForProfile as twinMemKeyForProfile,
    type TwinMemoryState,
  } from '$lib/stores/twinMemory';
  import {
    getSpeechRecognition,
    isSpeechRecognitionSupported,
    isSpeechSynthesisSupported,
    speakText,
    stopSpeaking,
    startMicLevelMonitor,
  } from '$lib/voice/speech';
  import { ChatUserBubble, ChatSuggestionChips, ChatComposerPill } from '$lib/chat';


  type TwinUiState = 'idle' | 'listening' | 'thinking' | 'speaking';

  /** Maps to TwinHeroBlob `state` prop */
  type HeroBlobState = 'idle' | 'focused' | 'typing' | 'thinking' | 'acting' | 'success' | 'error';

  interface Message {
    role: 'user' | 'ai';
    text: string;
    /** ISO-8601 when the user sent or the twin finished this turn */
    at?: string;
    cards?: Card[];
    loading?: boolean;
    error?: boolean;
    query?: string;
    intent?: string;
    suggested_followups?: string[];
    mood?: string;
    pendingActions?: TwinChatAction[];
  }

  let messages: Message[] = [];
  let threadSummary = '';
  let userTurnsSinceSummary = 0;
  let memoryKey = '';
  let twinMemKey = '';
  let twinMem: TwinMemoryState = { version: 1, facts: [], preferences: {}, recentTopics: [], identityOverrides: [], learnedAt: '' };
  let userTurnsSinceLearn = 0;

  let inputText = '';
  let chatEl: HTMLDivElement;
  let busy = false;
  let loadingStatus = '';
  let loadingDots = '';
  /** Abort in-flight chat when user sends again or leaves the page */
  let activeChatAbort: AbortController | null = null;
  /** Ignore catch/finally from superseded requests after rapid re-send */
  let chatSendGeneration = 0;

  let listening = false;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rec: any = null;
  let ttsPlaying = false;
  /** Mic energy for orb while dictating */
  let voiceLevel = 0;
  let stopMicLevel: (() => void) | null = null;

  /** Auto-speak mode: twin reads its responses aloud */
  let voiceMode = false;

  let draftOpen = false;
  let draftTo = '';
  let draftSubject = '';
  let draftBody = '';
  let draftSubmitting = false;

  let inputFocused = false;
  let typingLevel = 0;
  let lastTyped = 0;
  /** Filter full thread for recall (does not affect what is sent to the model). */
  let chatSearchQuery = '';
  $: chatSearchNorm = chatSearchQuery.trim().toLowerCase();
  $: messagesForList =
    !chatSearchNorm
      ? messages
      : messages.filter(m => (m.text || '').toLowerCase().includes(chatSearchNorm));

  function triggerRedPulse() {
    /* reserved for haptics / future accent pulse */
  }

  let heroBlobReady = false;

  let dotsInterval: ReturnType<typeof setInterval>;
  $: if (busy) {
    dotsInterval = setInterval(() => {
      loadingDots = loadingDots.length >= 3 ? '' : loadingDots + '.';
    }, 400);
  } else {
    clearInterval(dotsInterval);
    loadingDots = '';
  }

  $: city = $profile.instagramIdentity?.city ?? $profile.city ?? '';
  $: PROMPTS = buildTwinStarters(city, $profile);

  $: twinState = ((): TwinUiState => {
    if (listening) return 'listening';
    if (busy) return 'thinking';
    if (ttsPlaying) return 'speaking';
    return 'idle';
  })();

  $: blobUiState = ((): HeroBlobState => {
    if (twinState === 'listening') return 'focused';
    if (twinState === 'thinking') return 'thinking';
    if (twinState === 'speaking') return 'success';
    return 'idle';
  })();

  $: lastAiMood = [...messages].reverse().find(m => m.role === 'ai' && !m.loading && m.mood)?.mood;

  let showChips = true;

  let cloudSyncTimer: ReturnType<typeof setTimeout> | null = null;

  $: lastAi = [...messages].reverse().find(m => m.role === 'ai' && !m.loading && !m.error);

  // Signal completeness for chip strategy
  $: signalCount = [
    $profile.instagramConnected,
    $profile.spotifyConnected || $profile.appleMusicConnected,
    $profile.googleConnected,
    $profile.linkedinConnected,
  ].filter(Boolean).length;

  // Identity-building chips when profile is sparse
  const IDENTITY_CHIPS: { label: string; query: string }[] = [
    { label: 'My music taste', query: "I mostly listen to indie and electronic. What does that say about me?" },
    { label: 'Weekends', query: "On weekends I usually explore new cafes and go to local events" },
    { label: 'Food vibes', query: "I love Asian fusion and street food — what places should I try?" },
    { label: 'Work mode', query: "I work in tech/design. What would help me be more effective?" },
    { label: 'My aesthetic', query: "My style is minimal and dark — think Bottega, Rick Owens kind of vibe" },
    { label: 'What I want', query: "Help me figure out what to do this weekend based on my personality" },
  ];

  $: composerChips = ((): { label: string; query: string }[] => {
    if (messages.length === 0 && showChips) {
      // If sparse identity, show onboarding chips
      if (signalCount < 2) return IDENTITY_CHIPS.slice(0, 5);
      return PROMPTS.map((p) => ({ label: p.label, query: p.query }));
    }
    if (!lastAi) return [];
    if (lastAi.suggested_followups?.length) {
      return lastAi.suggested_followups.map((q) => ({
        label: q.length > 42 ? `${q.slice(0, 40)}…` : q,
        query: q,
      }));
    }
    if (lastAi.intent === 'event') {
      return [
        { label: 'This weekend', query: 'more events this weekend' },
        { label: 'How to book', query: `book tickets for ${lastAi.cards?.[0]?.title ?? 'this event'}` },
      ];
    }
    if (lastAi.intent === 'music') {
      return [
        { label: 'Similar artists', query: 'more artists like this' },
        { label: 'Live shows', query: 'concerts for these artists near me' },
      ];
    }
    if (lastAi.intent === 'food') {
      return [
        { label: 'Reserve', query: 'show me the menu and how to book' },
        { label: 'Similar', query: 'similar restaurants near me' },
      ];
    }
    if (lastAi.cards?.length) {
      return [
        { label: 'More like this', query: 'give me more like this' },
        { label: 'Different', query: 'something completely different' },
      ];
    }
    return [];
  })();

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

  function persistThread() {
    if (!memoryKey || typeof window === 'undefined') return;
    const stored: ChatMemoryState['messages'] = messages
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

  onMount(() => {
    memoryKey = memoryKeyForProfile($profile);
    twinMemKey = twinMemKeyForProfile($profile);
    twinMem = loadTwinMemory(twinMemKey);
    const local = loadChatMemory(memoryKey);
    threadSummary = local.summary ?? '';
    userTurnsSinceSummary = local.messages.filter(m => m.role === 'user').length % SUMMARY_EVERY_USER_TURNS;

    if (local.messages?.length) {
      messages = local.messages.map(m => ({
        role: m.role,
        text: m.text,
        at: m.at,
        cards: m.role === 'ai' ? cardRefsToCards(m.cardRefs) : [],
      }));
      showChips = false;
    }

    const sub = $profile.googleSub;
    const q = $page.url.searchParams.get('q');

    void (async () => {
      if (sub) {
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
                messages = merged.messages.map(m => ({
                  role: m.role,
                  text: m.text,
                  at: m.at,
                  cards: m.role === 'ai' ? cardRefsToCards(m.cardRefs) : [],
                }));
                showChips = false;
              } else if (!nowLocal.messages.length) {
                messages = [];
                showChips = true;
              }
              saveChatMemory(memoryKey, merged);
            }
          }
        } catch {
          /* keep local */
        }
      }
      if (q) {
        await send(q);
      } else if (!messages.length) {
        // No messages and no ?q= param — twin greets instantly (no API call)
        insertGreeting();
      }
    })();

    setTimeout(() => {
      heroBlobReady = true;
    }, 60);

    return () => {
      if (cloudSyncTimer) clearTimeout(cloudSyncTimer);
      stopListening();
      stopSpeaking();
    };
  });

  onDestroy(() => {
    activeChatAbort?.abort();
  });

  async function maybeRollSummary(prevUserCount: number, newUserCount: number) {
    if (!shouldRollSummary(prevUserCount, newUserCount)) return;
    const payload = messages
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
        persistThread();
      }
    } catch {
      /* ignore */
    }
  }

  async function maybeLearnFromChat(prevUserCount: number, newUserCount: number) {
    if (!shouldLearn(prevUserCount, newUserCount)) return;
    const payload = messages
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
        userTurnsSinceLearn = 0;
      }
    } catch {
      /* ignore */
    }
  }

  function stopListening() {
    stopMicLevel?.();
    stopMicLevel = null;
    voiceLevel = 0;
    try {
      rec?.stop();
    } catch {
      /* ignore */
    }
    rec = null;
    listening = false;
  }

  async function toggleListen() {
    const Ctor = getSpeechRecognition();
    if (!Ctor || busy) return;
    if (listening) {
      stopListening();
      return;
    }
    listening = true;
    stopMicLevel = await startMicLevelMonitor(level => {
      voiceLevel = level;
    });
    const r = new Ctor();
    r.continuous = false;
    r.interimResults = true;
    r.lang = 'en-IN';
    r.onresult = (e: unknown) => {
      const ev = e as { results?: ArrayLike<{ 0?: { transcript?: string } }> };
      const t = ev.results?.[0]?.[0]?.transcript ?? '';
      if (t) inputText = t;
    };
    r.onerror = () => {
      stopListening();
    };
    r.onend = () => {
      stopListening();
    };
    rec = r;
    try {
      r.start();
    } catch {
      stopListening();
    }
  }

  function speakLast(text: string) {
    if (!isSpeechSynthesisSupported() || !text?.trim()) return;
    stopSpeaking();
    ttsPlaying = true;
    const u = speakText(text);
    if (u && 'onend' in u) {
      (u as SpeechSynthesisUtterance).onend = () => {
        ttsPlaying = false;
      };
    } else {
      setTimeout(() => (ttsPlaying = false), Math.min(text.length * 50, 20000));
    }
  }

  async function send(text = inputText.trim()) {
    if (!text || busy) return;
    const myGen = ++chatSendGeneration;
    activeChatAbort?.abort();
    const prevUserCount = messages.filter(m => m.role === 'user').length;
    inputText = '';
    showChips = false;
    busy = true;
    loadingStatus = '…';

    const userAt = new Date().toISOString();
    messages = [...messages, { role: 'user', text, at: userAt }];
    let aiMsg: Message = { role: 'ai', text: '', cards: [], loading: true, query: text };
    messages = [...messages, aiMsg];
    await scrollBottom();

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
        messages = [...messages.slice(0, -1), aiMsg];
        void scrollBottom();
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
        messages = [...messages.slice(0, -1), aiMsg];
      }
    }

    const historyPayload = messages
      .filter(m => !m.loading && !m.error && m.text)
      .slice(-24)
      .map(m => ({
        role: m.role,
        text: m.text,
        ...(m.at ? { at: m.at } : {}),
        ...(m.role === 'ai' && m.cards?.length ? { cardRefs: toCardRefs(m.cards) } : {}),
      }));

    const chatCtl = new AbortController();
    activeChatAbort = chatCtl;
    const chatTimeout = setTimeout(() => chatCtl.abort(), 100_000);
    try {
      const twinMemPayload = twinMem.facts.length || Object.keys(twinMem.preferences).length || twinMem.identityOverrides?.length
        ? { facts: twinMem.facts, preferences: twinMem.preferences, recentTopics: twinMem.recentTopics, identityOverrides: twinMem.identityOverrides }
        : undefined;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          profile: $profile,
          googleSub: $profile.googleSub,
          history: historyPayload,
          threadSummary: threadSummary || undefined,
          twinMemory: twinMemPayload,
        }),
        signal: chatCtl.signal,
      });

      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

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
            const payload = JSON.parse(dataStr);
            if (eventType === 'status') {
              loadingStatus = payload.text;
              aiMsg = { ...aiMsg, loading: true };
            } else if (eventType === 'meta') {
              aiMsg = { ...aiMsg, intent: payload.intent };
              if (payload.useEventDomains) {
                loadingStatus = 'Searching BookMyShow, District, Urbanaut...';
              }
            } else if (eventType === 'card') {
              const card = ensureMatchReason(
                payload as Card,
                $profile.googleIdentity?.twin,
                getCurrentContext(),
              );
              aiMsg = { ...aiMsg, loading: false, cards: [...(aiMsg.cards ?? []), card] };
              await scrollBottom();
            } else if (eventType === 'text_delta') {
              queueStreamDelta(typeof payload.delta === 'string' ? payload.delta : '');
            } else if (eventType === 'message') {
              flushStreamPending();
              aiMsg = { ...aiMsg, text: payload.text ?? '', loading: false };
            } else if (eventType === 'extras') {
              aiMsg = {
                ...aiMsg,
                suggested_followups: payload.suggested_followups,
                mood: payload.mood,
                pendingActions: payload.actions,
              };
            } else if (eventType === 'error') {
              const errAt = new Date().toISOString();
              aiMsg = {
                role: 'ai',
                text: payload.text,
                cards: [],
                loading: false,
                error: true,
                query: text,
                at: errAt,
              };
              busy = false;
            } else if (eventType === 'done') {
              const doneAt = new Date().toISOString();
              aiMsg = { ...aiMsg, loading: false, at: aiMsg.at ?? doneAt };
              busy = false;
              triggerRedPulse();
            }
            messages = [...messages.slice(0, -1), aiMsg];
          } catch {
            /* ignore parse */
          }
        }
      }
    } catch {
      if (myGen !== chatSendGeneration) return;
      const errAt = new Date().toISOString();
      aiMsg = {
        role: 'ai',
        text: 'Something went wrong — the request timed out or the connection dropped. If this keeps happening, check your Brave Search API key in `.env` (server logs will say SUBSCRIPTION_TOKEN_INVALID) and restart `npm run dev`.',
        cards: [],
        loading: false,
        error: true,
        query: text,
        at: errAt,
      };
      messages = [...messages.slice(0, -1), aiMsg];
    } finally {
      flushStreamPending();
      clearTimeout(chatTimeout);
      if (myGen !== chatSendGeneration) {
        if (activeChatAbort === chatCtl) activeChatAbort = null;
        return;
      }
      if (activeChatAbort === chatCtl) activeChatAbort = null;
      loadingStatus = '';
      busy = false;
      if (!aiMsg.at && !aiMsg.loading) {
        aiMsg = { ...aiMsg, at: new Date().toISOString() };
        messages = [...messages.slice(0, -1), aiMsg];
      }
      await scrollBottom();
      persistThread();
      const newUserCount = messages.filter(m => m.role === 'user').length;
      void maybeRollSummary(prevUserCount, newUserCount);
      void maybeLearnFromChat(prevUserCount, newUserCount);
      // Auto-speak if voice mode is enabled
      if (voiceMode && aiMsg.text && !aiMsg.error) {
        speakLast(aiMsg.text);
      }
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try {
          navigator.vibrate(12);
        } catch {
          /* ignore */
        }
      }
    }
  }

  function retry(query: string) {
    messages = messages.slice(0, -2);
    void send(query);
  }

  /** Insert an instant client-side greeting — no API call, no busy state */
  function insertGreeting() {
    if (messages.length > 0) return;
    const name = $profile.name?.split(' ')[0] || 'there';

    const connectedPlatforms = [
      $profile.instagramConnected && 'Instagram',
      ($profile.spotifyConnected || $profile.appleMusicConnected) && 'Music',
      $profile.googleConnected && 'Google',
      $profile.linkedinConnected && 'LinkedIn',
    ].filter(Boolean) as string[];

    const vibe =
      $profile.spotifyIdentity?.vibeDescription ||
      $profile.appleMusicIdentity?.vibeDescription ||
      $profile.instagramIdentity?.aesthetic || '';

    const city = $profile.city || $profile.instagramIdentity?.city || '';

    let text: string;
    let followups: string[];

    if (connectedPlatforms.length === 0) {
      text = `Hey ${name}! I'm your digital twin. Connect your platforms in Profile — Instagram, Spotify, Google, LinkedIn — and I'll know your taste, schedule, and vibe deeply. What can I help with right now?`;
      followups = ['What can you do?', 'Help me plan something', 'Connect platforms'];
    } else {
      const contextBits: string[] = [];
      if (vibe) contextBits.push(vibe.slice(0, 50).toLowerCase());
      if (city) contextBits.push(city);
      const contextStr = contextBits.length ? ` — ${contextBits.join(', ')}` : '';

      // Pick gap question
      const hasMusic = $profile.spotifyConnected || $profile.appleMusicConnected;
      const hasLinkedIn = $profile.linkedinConnected;
      const hasGoogle = $profile.googleConnected;

      let gapQ = 'What would you like to do today?';
      if (!hasMusic) gapQ = "What kind of music have you been into lately?";
      else if (!hasLinkedIn) gapQ = "What do you do for work?";
      else if (!hasGoogle) gapQ = "What's on your agenda today?";

      text = `Hey ${name}! I've got your ${connectedPlatforms.join(' + ')} signals${contextStr}. ${gapQ}`;
      followups = ["Plan my day", "What's happening tonight?", "Music for my mood", "Something based on my vibe"];
    }

    const greet: Message = {
      role: 'ai',
      text,
      cards: [],
      loading: false,
      at: new Date().toISOString(),
      suggested_followups: followups,
      mood: 'warm',
    };
    messages = [greet];
    showChips = false;
    // Optionally speak the greeting if voice mode is on
    if (voiceMode) speakLast(text);
  }

  async function scrollBottom() {
    await tick();
    if (chatEl) chatEl.scrollTo({ top: chatEl.scrollHeight, behavior: 'smooth' });
  }


  function bumpTypingEnergy() {
    lastTyped = Date.now();
    typingLevel = Math.min(1, typingLevel + 0.25);
  }

  function applyAction(a: TwinChatAction) {
    if (a.type === 'set_reminder' && a.text) {
      reminders.add(a.text, a.when, '🔔');
      return;
    }
    if (a.type === 'navigate' && a.path) {
      goto(a.path);
      return;
    }
    if (a.type === 'copy_text' && a.text) {
      void navigator.clipboard.writeText(a.text);
      return;
    }
    if (a.type === 'gmail_draft') {
      draftTo = a.to ?? '';
      draftSubject = a.subject ?? '';
      draftBody = a.body ?? '';
      draftOpen = true;
    }
  }

  async function confirmDraft() {
    if (!draftTo || !draftSubject || !$profile.googleAccessToken) return;
    draftSubmitting = true;
    try {
      const res = await fetch('/api/google/gmail/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: $profile.googleAccessToken,
          refreshToken: $profile.googleRefreshToken,
          to: draftTo,
          subject: draftSubject,
          body: draftBody,
        }),
      });
      const data = await res.json();
      if (data.newToken) profile.update(p => ({ ...p, googleAccessToken: data.newToken }));
      draftOpen = false;
      messages = [
        ...messages,
        {
          role: 'ai',
          text: data.ok
            ? 'Draft saved in Gmail — open Gmail to review and send.'
            : 'Could not create the draft. Check Google connection and gmail.compose permission.',
          cards: [],
          at: new Date().toISOString(),
        },
      ];
      await scrollBottom();
    } finally {
      draftSubmitting = false;
    }
  }

</script>

<!-- Living presence root -->
<div class="presence-root">

  <!-- Twin header -->
  <div class="twin-header">
    <TwinPresence state={twinState} mood={lastAiMood} compact />
    <div class="twin-header-info">
      <span class="twin-name">Your twin</span>
      <div class="twin-status-line">
        <span
          class="status-dot"
          style="background: {listening ? 'var(--accent-primary)' : busy ? 'var(--text-muted)' : 'var(--state-success)'};"
        ></span>
        <span class="twin-subtitle">
          {#if listening}Listening...
          {:else if busy}{loadingStatus || 'Thinking...'}
          {:else if ttsPlaying}Speaking...
          {:else}{$profile.instagramConnected ? '@' + ($profile.instagramIdentity?.username ?? '') : 'Ready'}
            {#if $profile.spotifyConnected} · 🎵{/if}
          {/if}
        </span>
      </div>
    </div>
  </div>

  <!-- Messages scroll area -->
  <div bind:this={chatEl} class="messages-area">
    <div class="messages-top-spacer"></div>

    {#if messages.length === 0}
    <div class="empty-state fade-up">
      <div class="empty-blob-wrap">
        <TwinHeroBlob state={busy ? 'thinking' : blobUiState} typingEnergy={typingLevel} ready={heroBlobReady} />
      </div>
      {#if busy}
        <h2 class="cw-heading">Getting to know you…</h2>
        <p class="cw-sub">Your twin is reading your signals.</p>
      {:else if signalCount === 0}
        <h2 class="cw-heading">Hey, I'm your twin</h2>
        <p class="cw-sub">Connect platforms in Profile and I'll know you deeply — music, calendar, work, lifestyle.</p>
      {:else}
        <h2 class="cw-heading">Hey {$profile.name?.split(' ')[0] || 'there'}</h2>
        <p class="cw-sub">Ask me anything — I'll use your identity to give you personalised answers.</p>
      {/if}
    </div>
    {/if}

    {#if messages.length > 0}
      <div class="chat-thread-search">
        <input
          type="search"
          bind:value={chatSearchQuery}
          class="chat-thread-search__input"
          placeholder="Search this chat…"
          aria-label="Search messages in this thread"
          autocomplete="off"
        />
        {#if chatSearchQuery.trim()}
          <button
            type="button"
            class="chat-thread-search__clear"
            on:click={() => (chatSearchQuery = '')}
          >
            Clear
          </button>
        {/if}
      </div>
    {/if}

    {#if chatSearchNorm && messages.length > 0 && messagesForList.length === 0}
      <p class="chat-thread-search-empty">No messages match your search.</p>
    {/if}

    {#each messagesForList as msg}
      {#if msg.role === 'user'}
        <ChatUserBubble text={msg.text} fadeClass="wagwan-chat-fade-up" airy />

      {:else}
      <div class="msg-ai fade-up">
        {#if msg.loading}
          <div class="msg-loading">
            <span class="loading-text">{loadingStatus || 'Thinking'}{loadingDots}</span>
          </div>

        {:else if msg.error}
          <div class="msg-error">{msg.text}</div>
          {#if msg.query}
          <button class="retry-btn" on:click={() => retry(msg.query!)}>↩ Try again</button>
          {/if}

        {:else}
          <div class="msg-text">{msg.text}</div>

          <!-- TTS -->
          {#if isSpeechSynthesisSupported()}
          <div class="msg-tools">
            <button class="tool-chip" on:click={() => speakLast(msg.text)}>🔊 Read</button>
          </div>
          {/if}

          <!-- Pending actions -->
          {#if msg.pendingActions?.length}
          <div class="action-chips">
            {#each msg.pendingActions as a}
            <button class="action-chip" on:click={() => applyAction(a)}>
              {#if a.type === 'set_reminder'}🔔 {a.text}
              {:else if a.type === 'gmail_draft'}✉️ Save Gmail draft
              {:else if a.type === 'navigate'}→ {a.path}
              {:else if a.type === 'copy_text'}📋 Copy
              {:else}Run action{/if}
            </button>
            {/each}
          </div>
          {/if}

          <!-- Result cards -->
          {#if msg.cards?.length}
          <div class="msg-cards">
            {#each msg.cards as card (card.title + card.url)}
            <div class="fade-up"><ResultCard {card} /></div>
            {/each}
          </div>
          {/if}

        {/if}
      </div>
      {/if}
    {/each}

    <div class="messages-bottom-spacer"></div>
  </div>

  <!-- Composer stack: shared chat module (same chrome as agent threads) -->
  <div class="composer-stack">
    <ChatSuggestionChips
      items={composerChips.map(c => ({ label: c.label, value: c.query }))}
      disabled={busy}
      layout="twin"
      on:pick={e => send(e.detail.value)}
    />
    <div class="composer-wrap">
      <ChatComposerPill
        variant="twin"
        bind:value={inputText}
        placeholder="Message your twin…"
        disabled={false}
        {busy}
        focused={inputFocused}
        on:input={bumpTypingEnergy}
        on:focus={() => { inputFocused = true; }}
        on:blur={() => { inputFocused = false; }}
        on:submit={() => send()}
      >
        <svelte:fragment slot="leading">
          {#if isSpeechRecognitionSupported()}
            <button
              type="button"
              title={listening ? 'Stop listening' : 'Voice input'}
              on:click={() => void toggleListen()}
              disabled={busy}
              class="composer-mic"
              class:live={listening}
              aria-label={listening ? 'Stop listening' : 'Voice input'}
              aria-pressed={listening}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8" />
              </svg>
            </button>
          {/if}
        </svelte:fragment>
        <svelte:fragment slot="before-send">
          {#if isSpeechSynthesisSupported()}
            <button
              type="button"
              on:click={() => {
                voiceMode = !voiceMode;
                if (!voiceMode) stopSpeaking();
              }}
              class="composer-side composer-voice-toggle"
              class:active={voiceMode}
              title={voiceMode ? 'Voice replies on — click to mute' : 'Enable voice replies'}
              aria-label={voiceMode ? 'Mute twin voice' : 'Enable twin voice'}
              aria-pressed={voiceMode}
            >
              {#if voiceMode}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              {:else}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              {/if}
            </button>
          {/if}
        </svelte:fragment>
      </ChatComposerPill>
      <div class="composer-footnote">Saved on this device · Profile to clear memory</div>
    </div>
  </div>
</div>

<!-- Gmail draft modal -->
{#if draftOpen}
<div class="ai-draft-overlay" role="dialog" aria-modal="true">
  <div class="ai-draft-sheet">
    <div class="ai-draft-title">Save Gmail draft?</div>
    <p class="ai-draft-lead">Review recipient and body. Nothing is sent until you send from Gmail.</p>
    <label for="draft-to" class="ai-draft-label">To</label>
    <input id="draft-to" bind:value={draftTo} class="ai-draft-field w-full mb-3" />
    <label for="draft-subject" class="ai-draft-label">Subject</label>
    <input id="draft-subject" bind:value={draftSubject} class="ai-draft-field w-full mb-3" />
    <label for="draft-body" class="ai-draft-label">Body</label>
    <textarea id="draft-body" bind:value={draftBody} rows="6" class="ai-draft-field ai-draft-field--area w-full mb-4"></textarea>
    <div class="flex gap-2">
      <button type="button" class="ai-draft-btn ai-draft-btn--ghost flex-1 py-3 rounded-xl" on:click={() => { draftOpen = false; }}
      >Cancel</button>
      <button
        type="button"
        class="ai-draft-btn ai-draft-btn--primary flex-1 py-3 rounded-xl"
        disabled={draftSubmitting || !$profile.googleConnected}
        on:click={confirmDraft}
      >Save draft</button>
    </div>
    {#if !$profile.googleConnected}
      <p style="font-size:11px;color:var(--amber);margin-top:10px;">Connect Google in Profile (includes Gmail compose) to save drafts.</p>
    {/if}
  </div>
</div>
{/if}

<style>
  .ai-draft-overlay {
    position: fixed;
    inset: 0;
    z-index: 80;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    padding: 16px;
    background: color-mix(in srgb, var(--bg-primary) 35%, rgba(0, 0, 0, 0.72));
  }

  .ai-draft-sheet {
    width: 100%;
    max-width: min(32rem, 100%);
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 20px;
    padding: 18px;
    max-height: 85vh;
    overflow-y: auto;
  }

  .ai-draft-title {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 10px;
    color: var(--text-primary);
  }

  .ai-draft-lead {
    font-size: 12px;
    color: var(--text2);
    margin-bottom: 12px;
    line-height: 1.45;
  }

  .ai-draft-label {
    display: block;
    font-size: 11px;
    color: var(--text3);
    margin-bottom: 4px;
  }

  .ai-draft-field {
    background: var(--glass-medium);
    border: 1px solid var(--border-strong);
    border-radius: 10px;
    padding: 10px 12px;
    color: var(--text);
    font-size: 14px;
    width: 100%;
    box-sizing: border-box;
  }

  .ai-draft-field:focus {
    outline: none;
    border-color: var(--border-strong);
    box-shadow: var(--accent-glow);
  }

  .ai-draft-field--area {
    resize: vertical;
    min-height: 120px;
    font-family: inherit;
  }

  .ai-draft-btn {
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: opacity var(--dur-micro) var(--ease-premium);
  }

  .ai-draft-btn--ghost {
    background: var(--glass-light);
    color: var(--text-primary);
  }

  .ai-draft-btn--primary {
    background: linear-gradient(135deg, var(--brand-red), color-mix(in srgb, var(--brand-red) 75%, #000));
    color: #fff;
  }

  .ai-draft-btn:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  /* ── Root ─────────────────────────────────────────────────────────────── */
  .presence-root {
    position: relative;
    height: 100%;
    min-height: 0;
    overflow: hidden;
    background: var(--bg-primary);
    display: flex;
    flex-direction: column;
  }

  /* ── Twin header ─────────────────────────────────────────────────────── */
  .twin-header {
    position: relative;
    z-index: 10;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 52px 20px 14px;
    background: var(--glass-light);
    border-bottom: 1px solid var(--border-subtle);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .twin-header-info {
    flex: 1;
    min-width: 0;
  }

  .twin-name {
    display: block;
    font-size: 16px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.2;
  }

  .twin-status-line {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 3px;
  }

  .status-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    transition: background var(--dur-standard) var(--ease-premium);
  }

  .twin-subtitle {
    font-size: 11px;
    color: var(--text2);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Messages area ───────────────────────────────────────────────────── */
  .messages-area {
    position: relative;
    z-index: 5;
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    overscroll-behavior: contain;
    scrollbar-width: none;
    -webkit-overflow-scrolling: touch;
    display: flex;
    flex-direction: column;
    padding: 0 20px;
  }

  .messages-area::-webkit-scrollbar {
    display: none;
  }

  .messages-top-spacer {
    height: 72px;
    flex-shrink: 0;
  }

  .chat-thread-search {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
    margin-bottom: 12px;
    padding: 0 2px;
  }

  .chat-thread-search__input {
    flex: 1;
    min-width: 0;
    height: 36px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    color: var(--text-primary);
    font-family: var(--font-sans);
    font-size: 13px;
    transition: border-color var(--dur-micro) var(--ease-premium), box-shadow var(--dur-micro) var(--ease-premium);
  }

  .chat-thread-search__input:focus {
    outline: none;
    border-color: var(--border-strong);
    box-shadow: var(--accent-glow);
  }

  .chat-thread-search__input::placeholder {
    color: var(--text-muted);
  }

  .chat-thread-search__clear {
    flex-shrink: 0;
    padding: 6px 10px;
    border-radius: 8px;
    border: none;
    background: transparent;
    color: var(--accent-primary);
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }

  .chat-thread-search__clear:hover {
    background: var(--panel-hover);
  }

  .chat-thread-search-empty {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--text-muted);
    text-align: center;
  }

  .messages-bottom-spacer {
    height: 96px;
    flex-shrink: 0;
  }

  /* ── Empty state ─────────────────────────────────────────────────────── */
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding-top: max(4vh, 24px);
  }

  .empty-blob-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
    margin-bottom: 8px;
  }

  .empty-blob-wrap :global(.twin-blob-root) {
    width: min(72vmin, 260px);
  }

  .cw-heading {
    margin: 0;
    font-family: var(--font-display);
    font-size: 20px;
    font-weight: 600;
    font-style: italic;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    text-align: center;
    padding: 0 16px;
  }

  .cw-sub {
    margin: 0 0 8px;
    font-size: 14px;
    color: var(--text-muted);
    text-align: center;
    padding: 0 20px;
    max-width: 22rem;
  }

  /* ── Composer stack (chips + pill live in $lib/chat) ───────────────── */
  .composer-stack {
    position: relative;
    z-index: 10;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 0 14px;
  }

  .msg-ai {
    align-self: flex-start;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0 0 24px;
  }

  .msg-text {
    font-family: var(--font-sans);
    font-size: 15px;
    line-height: 1.7;
    color: var(--text-primary);
    max-width: min(37.5rem, 100%);
    padding: 14px 18px;
    background: var(--glass-light);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border-radius: 4px 18px 18px 18px;
    border: 1px solid var(--border-subtle);
  }

  .msg-text :global(strong),
  .msg-text :global(b) {
    font-family: var(--font-display);
    font-style: italic;
  }

  .msg-error {
    font-size: 14px;
    line-height: 1.6;
    color: var(--state-error);
    max-width: min(37.5rem, 100%);
    padding: 12px 16px;
    background: color-mix(in srgb, var(--state-error) 8%, transparent);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 14px;
    border: 1px solid color-mix(in srgb, var(--state-error) 22%, transparent);
  }

  /* Loading state */
  .msg-loading {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 28px;
    padding: 12px 16px;
    background: var(--glass-light);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-radius: 4px 16px 16px 16px;
    border: 1px solid var(--border-subtle);
  }

  .loading-text {
    font-size: 13px;
    color: var(--text-muted);
  }

  /* Tool chips */
  .msg-tools {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .tool-chip {
    font-size: 12px;
    color: var(--text-muted);
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    transition: color var(--dur-micro) var(--ease-premium);
  }

  .tool-chip:hover {
    color: var(--text-secondary);
  }

  /* Action chips */
  .action-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .action-chip {
    font-size: 13px;
    padding: 9px 16px;
    background: var(--glass-light);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid var(--border-subtle);
    border-radius: 100px;
    color: var(--text-primary);
    cursor: pointer;
    text-align: left;
    transition: background var(--dur-standard) var(--ease-premium), border-color var(--dur-standard) var(--ease-premium);
    white-space: normal;
  }

  .action-chip:hover {
    background: var(--glass-medium);
    border-color: var(--border-strong);
  }

  .retry-btn {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent-tertiary);
    background: var(--brand-red-soft);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--pill-warn-border);
    padding: 8px 18px;
    border-radius: 100px;
    cursor: pointer;
    transition: background var(--dur-micro) var(--ease-premium);
  }

  .retry-btn:hover {
    background: color-mix(in srgb, var(--brand-red) 16%, transparent);
  }

  /* Cards — compact list */
  .msg-cards {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
  }

  /* ── Composer ────────────────────────────────────────────────────────── */
  .composer-wrap {
    position: relative;
    z-index: 10;
    flex-shrink: 0;
    padding: 2px 0 max(12px, calc(env(safe-area-inset-bottom, 0px) + 8px));
    background: linear-gradient(
      to top,
      color-mix(in srgb, var(--bg-primary) 98%, transparent) 0%,
      color-mix(in srgb, var(--bg-primary) 88%, transparent) 100%
    );
  }

  .composer-mic {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 50%;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background var(--dur-standard) var(--ease-premium), border-color var(--dur-standard) var(--ease-premium), box-shadow var(--dur-standard) var(--ease-premium);
  }

  .composer-mic:focus-visible {
    outline: none;
    box-shadow: var(--accent-glow);
    border-color: var(--border-strong);
  }

  .composer-mic:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .composer-mic.live {
    background: color-mix(in srgb, var(--accent-primary) 22%, var(--glass-light));
    border-color: color-mix(in srgb, var(--accent-primary) 40%, var(--border-subtle));
    color: var(--accent-primary);
    animation: mic-glow 1.1s ease-in-out infinite;
  }

  @keyframes mic-glow {
    0%,
    100% {
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent-primary) 15%, transparent);
    }
    50% {
      box-shadow:
        0 0 0 5px color-mix(in srgb, var(--accent-primary) 22%, transparent),
        0 0 20px color-mix(in srgb, var(--accent-primary) 18%, transparent);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .composer-mic.live { animation: none; }
  }

  .composer-side {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
    border-radius: 12px;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    cursor: pointer;
    font-size: 17px;
    line-height: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-muted);
    transition: background var(--dur-micro) var(--ease-premium), border-color var(--dur-micro) var(--ease-premium), color var(--dur-micro) var(--ease-premium);
  }

  .composer-side:focus-visible {
    outline: none;
    box-shadow: var(--accent-glow);
    border-color: var(--border-strong);
  }

  .composer-side:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .composer-side:not(:disabled):hover {
    background: var(--glass-medium);
  }

  .composer-voice-toggle.active {
    background: color-mix(in srgb, var(--accent-primary) 18%, var(--glass-light));
    border-color: color-mix(in srgb, var(--accent-primary) 40%, var(--border-subtle));
    color: var(--accent-primary);
  }

  .composer-footnote {
    font-size: 10px;
    color: var(--text3);
    text-align: center;
    margin-top: 7px;
    max-width: min(56rem, 100%);
    margin-left: auto;
    margin-right: auto;
  }

</style>
