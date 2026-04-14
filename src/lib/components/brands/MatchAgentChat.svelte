<script lang="ts">
  import { onMount, tick, createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  type Message = { role: 'user' | 'agent'; text: string; id: number };

  let messages: Message[] = [];
  let input = '';
  let loading = false;
  let chatEl: HTMLDivElement;
  let inputEl: HTMLTextAreaElement;
  let msgId = 0;
  let mounted = false;

  const SUGGESTIONS = [
    'We sell developer tools to early-stage founders',
    'B2B SaaS for HR teams at growing startups',
    'Premium skincare targeting wellness-conscious millennials',
  ];

  async function scrollToBottom() {
    await tick();
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
  }

  function autoGrow() {
    if (!inputEl) return;
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  onMount(() => {
    setTimeout(() => { mounted = true; }, 100);
    setTimeout(() => {
      messages = [{ role: 'agent', text: 'Tell me about what you\'re trying to sell and who buys it.', id: ++msgId }];
    }, 600);
  });

  function useSuggestion(text: string) {
    input = text;
    if (inputEl) { inputEl.focus(); autoGrow(); }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    input = '';
    if (inputEl) inputEl.style.height = 'auto';
    messages = [...messages, { role: 'user', text, id: ++msgId }];
    loading = true;
    await scrollToBottom();

    try {
      const res = await fetch('/api/brand/match-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(0, -1).map(m => ({ role: m.role, text: m.text })),
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let agentText = '';
      let buffer = '';
      const newId = ++msgId;

      messages = [...messages, { role: 'agent', text: '', id: newId }];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const chunks = buffer.split('\n\n');
        buffer = chunks.pop() ?? '';

        for (const chunk of chunks) {
          const eventMatch = chunk.match(/event: (\w+)\ndata: (.*)/s);
          if (!eventMatch) continue;
          const [, eventType, dataStr] = eventMatch;
          try {
            const data = JSON.parse(dataStr);
            if (eventType === 'text_delta' && data.delta) {
              agentText += data.delta;
              messages = [...messages.slice(0, -1), { role: 'agent', text: agentText, id: newId }];
              await scrollToBottom();
            } else if (eventType === 'message' && data.text) {
              agentText = data.text;
              messages = [...messages.slice(0, -1), { role: 'agent', text: agentText, id: newId }];
            } else if (eventType === 'matches' && data.results) {
              dispatch('matches', data.results);
            } else if (eventType === 'brief' && data.brief) {
              dispatch('brief', data.brief);
            }
          } catch {}
        }
      }

      if (agentText) {
        messages = [...messages.slice(0, -1), { role: 'agent', text: agentText, id: newId }];
      }
    } catch {
      messages = [...messages, { role: 'agent', text: 'Something went wrong. Please try again.', id: ++msgId }];
    } finally {
      loading = false;
      await scrollToBottom();
    }
  }
</script>

<div class="chat" class:mounted>
  <div class="chat-scroll" bind:this={chatEl}>
    <div class="chat-column">

      {#if messages.length === 0 && !loading}
        <div class="empty">
          <div class="empty-orb" aria-hidden="true"></div>
          <h1 class="empty-title">Find your audience</h1>
          <p class="empty-sub">Describe your product and who buys it. Our AI will match you to the right creators.</p>
          <div class="suggestions">
            {#each SUGGESTIONS as s, i}
              <button
                class="suggestion"
                style="animation-delay: {0.8 + i * 0.1}s"
                on:click={() => useSuggestion(s)}
              >
                <span class="suggestion-text">{s}</span>
                <svg class="suggestion-arrow" width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#each messages as msg (msg.id)}
        <div
          class="msg"
          class:msg--user={msg.role === 'user'}
          class:msg--agent={msg.role === 'agent'}
          class:msg--first={msg.id === 1}
        >
          {#if msg.role === 'agent'}
            <div class="agent-mark" aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <circle cx="6" cy="6" r="2" fill="var(--accent-secondary)"/>
                <circle cx="6" cy="6" r="5" stroke="var(--accent-secondary)" stroke-width="0.8" opacity="0.3"/>
              </svg>
            </div>
          {/if}
          <div class="msg-content">
            <p class="msg-text">{msg.text}</p>
          </div>
        </div>
      {/each}

      {#if loading}
        <div class="msg msg--agent">
          <div class="agent-mark" aria-hidden="true">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <circle cx="6" cy="6" r="2" fill="var(--accent-secondary)"/>
              <circle cx="6" cy="6" r="5" stroke="var(--accent-secondary)" stroke-width="0.8" opacity="0.3"/>
            </svg>
          </div>
          <div class="msg-content">
            <div class="typing">
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
              <span class="typing-dot"></span>
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div class="input-dock">
    <div class="input-shell">
      <div class="input-core">
        <textarea
          bind:this={inputEl}
          bind:value={input}
          on:input={autoGrow}
          on:keydown={handleKeydown}
          class="input-field"
          placeholder="Describe your product, your audience, or ask a question..."
          rows="1"
          disabled={loading}
        ></textarea>
        <button
          class="send"
          on:click={send}
          disabled={loading || !input.trim()}
          aria-label="Send"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
    <p class="input-hint">Wagwan matches by identity signal, not follower count</p>
  </div>
</div>

<style>
  .chat {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    opacity: 0;
    transition: opacity 0.6s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .chat.mounted { opacity: 1; }

  .chat-scroll {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .chat-scroll::-webkit-scrollbar { display: none; }

  .chat-column {
    max-width: 680px;
    margin: 0 auto;
    padding: 48px 24px 32px;
    display: flex;
    flex-direction: column;
    gap: 28px;
    min-height: 100%;
  }

  /* ── Empty ── */
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 4rem 0;
    position: relative;
  }

  .empty-orb {
    position: absolute;
    width: 320px;
    height: 320px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(77,124,255,0.06), transparent 70%);
    pointer-events: none;
    animation: orb-breathe 8s cubic-bezier(0.32, 0.72, 0, 1) infinite;
  }

  @keyframes orb-breathe {
    0%, 100% { transform: scale(1); opacity: 0.6; }
    50% { transform: scale(1.15); opacity: 1; }
  }

  .empty-title {
    position: relative;
    font-size: clamp(2rem, 5vw, 3rem);
    font-weight: 600;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.1;
  }

  .empty-sub {
    position: relative;
    font-size: 1rem;
    color: var(--text-muted);
    margin: 1rem 0 0;
    max-width: 24rem;
    line-height: 1.6;
  }

  .suggestions {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 2.5rem;
    width: 100%;
    max-width: 24rem;
  }

  .suggestion {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 14px;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-secondary);
    font-size: 0.875rem;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
    opacity: 0;
    transform: translateY(8px);
    animation: fade-up 0.5s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    transition: border-color 0.3s cubic-bezier(0.32, 0.72, 0, 1), background 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .suggestion:hover {
    border-color: var(--border-strong);
    background: var(--glass-light);
  }

  .suggestion:active { transform: scale(0.98) translateY(0); }
  .suggestion-text { flex: 1; }

  .suggestion-arrow {
    color: var(--text-muted);
    flex-shrink: 0;
    opacity: 0;
    transform: translateX(-4px);
    transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .suggestion:hover .suggestion-arrow {
    opacity: 1;
    transform: translateX(0);
  }

  @keyframes fade-up {
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Messages ── */
  .msg {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    opacity: 0;
    animation: msg-in 0.4s cubic-bezier(0.32, 0.72, 0, 1) forwards;
  }

  @keyframes msg-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .msg--user { justify-content: flex-end; }

  .agent-mark {
    flex-shrink: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 4px;
  }

  .msg-content { max-width: 85%; }

  .msg-text {
    margin: 0;
    font-size: 0.9375rem;
    line-height: 1.7;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .msg--agent .msg-text { color: var(--text-secondary); }

  .msg--first .msg-text {
    font-size: 1.25rem;
    font-weight: 500;
    line-height: 1.5;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .msg--user .msg-text {
    color: var(--text-primary);
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    padding: 12px 16px;
    border-radius: 18px 18px 4px 18px;
  }

  /* ── Typing ── */
  .typing {
    display: flex;
    gap: 5px;
    padding: 6px 0;
  }

  .typing-dot {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: var(--accent-secondary);
    opacity: 0.4;
    animation: dot-wave 1.4s cubic-bezier(0.32, 0.72, 0, 1) infinite;
  }
  .typing-dot:nth-child(2) { animation-delay: 0.15s; }
  .typing-dot:nth-child(3) { animation-delay: 0.3s; }

  @keyframes dot-wave {
    0%, 60%, 100% { transform: translateY(0); opacity: 0.3; }
    30% { transform: translateY(-4px); opacity: 1; }
  }

  /* ── Input ── */
  .input-dock { padding: 0 24px 20px; }

  .input-shell {
    max-width: 680px;
    margin: 0 auto;
    padding: 3px;
    border-radius: 20px;
    background: linear-gradient(135deg, rgba(77,124,255,0.12), rgba(255,77,77,0.08), rgba(255,184,77,0.06));
    transition: background 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .input-shell:focus-within {
    background: linear-gradient(135deg, rgba(77,124,255,0.20), rgba(255,77,77,0.14), rgba(255,184,77,0.10));
  }

  .input-core {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    background: var(--bg-secondary);
    border-radius: calc(20px - 3px);
    padding: 10px 10px 10px 20px;
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.04);
  }

  .input-field {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 0.9375rem;
    font-family: inherit;
    line-height: 1.5;
    resize: none;
    padding: 4px 0;
    max-height: 160px;
  }

  .input-field::placeholder { color: var(--text-muted); }
  .input-field:disabled { opacity: 0.4; }

  .send {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    border: none;
    background: var(--accent-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .send:hover { transform: scale(1.05); }
  .send:active { transform: scale(0.93); }
  .send:disabled { opacity: 0.2; cursor: default; transform: none; }

  .input-hint {
    max-width: 680px;
    margin: 8px auto 0;
    font-size: 0.6875rem;
    color: var(--text-muted);
    text-align: center;
    opacity: 0.6;
  }

  @media (max-width: 767px) {
    .chat-column { padding: 32px 16px 24px; }
    .input-dock { padding: 0 16px 16px; }
    .empty-title { font-size: 1.75rem; }
  }
</style>
