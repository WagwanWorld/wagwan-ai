<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  type Message = { role: 'user' | 'agent'; text: string };

  let messages: Message[] = [];
  let input = '';
  let loading = false;
  let chatEl: HTMLDivElement;
  let inputEl: HTMLTextAreaElement;

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
    messages = [{ role: 'agent', text: 'Tell me about what you\'re trying to sell and who buys it.' }];
  });

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    input = '';
    if (inputEl) inputEl.style.height = 'auto';
    messages = [...messages, { role: 'user', text }];
    loading = true;
    await scrollToBottom();

    try {
      const res = await fetch('/api/brand/match-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(0, -1),
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let agentText = '';
      let buffer = '';

      messages = [...messages, { role: 'agent', text: '' }];

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
              messages = [...messages.slice(0, -1), { role: 'agent', text: agentText }];
              await scrollToBottom();
            } else if (eventType === 'message' && data.text) {
              agentText = data.text;
              messages = [...messages.slice(0, -1), { role: 'agent', text: agentText }];
            }
            if (eventType === 'matches' && data.results) {
              dispatch('matches', data.results);
            }
            if (eventType === 'brief' && data.brief) {
              dispatch('brief', data.brief);
            }
          } catch {}
        }
      }

      if (agentText) {
        messages = [...messages.slice(0, -1), { role: 'agent', text: agentText }];
      }
    } catch {
      messages = [...messages, { role: 'agent', text: 'Something went wrong. Please try again.' }];
    } finally {
      loading = false;
      await scrollToBottom();
    }
  }
</script>

<div class="chat-root">
  <div class="chat-scroll" bind:this={chatEl}>
    <div class="chat-inner">
      {#if messages.length === 0}
        <div class="chat-empty">
          <h1 class="chat-welcome">Find your audience</h1>
          <p class="chat-welcome-sub">Describe your product and who buys it. We'll match you to the right creators.</p>
        </div>
      {/if}

      {#each messages as msg, i}
        {#if msg.role === 'agent'}
          <div class="msg msg--agent" class:msg--first={i === 0}>
            <p class="msg-text">{msg.text}</p>
          </div>
        {:else}
          <div class="msg msg--user">
            <p class="msg-text">{msg.text}</p>
          </div>
        {/if}
      {/each}

      {#if loading}
        <div class="msg msg--agent">
          <div class="dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div class="input-bar">
    <div class="input-inner">
      <textarea
        bind:this={inputEl}
        bind:value={input}
        on:input={autoGrow}
        on:keydown={handleKeydown}
        class="input-field"
        placeholder="Describe your product, audience, or campaign goals..."
        rows="1"
        disabled={loading}
      ></textarea>
      <button
        class="send-btn"
        on:click={send}
        disabled={loading || !input.trim()}
        aria-label="Send"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    </div>
  </div>
</div>

<style>
  .chat-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }

  .chat-scroll {
    flex: 1;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .chat-scroll::-webkit-scrollbar { display: none; }

  .chat-inner {
    max-width: 640px;
    margin: 0 auto;
    padding: 48px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 24px;
    min-height: 100%;
  }

  /* Empty state */
  .chat-empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    gap: 12px;
  }

  .chat-welcome {
    font-size: clamp(28px, 5vw, 40px);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin: 0;
  }

  .chat-welcome-sub {
    font-size: 15px;
    color: var(--text-muted);
    max-width: 24rem;
    line-height: 1.5;
    margin: 0;
  }

  /* Messages */
  .msg { max-width: 100%; }

  .msg--agent {
    padding-right: 48px;
  }

  .msg--first .msg-text {
    font-size: 20px;
    font-weight: 500;
    line-height: 1.4;
    color: var(--text-primary);
  }

  .msg--user {
    display: flex;
    justify-content: flex-end;
  }

  .msg--user .msg-text {
    background: var(--glass-medium);
    border-radius: 16px 16px 4px 16px;
    padding: 12px 16px;
    max-width: 80%;
  }

  .msg-text {
    margin: 0;
    font-size: 15px;
    line-height: 1.65;
    color: var(--text-primary);
    white-space: pre-wrap;
    word-break: break-word;
  }

  .msg--agent .msg-text {
    color: var(--text-secondary);
  }

  .msg--first .msg-text {
    color: var(--text-primary);
  }

  /* Loading dots */
  .dots {
    display: flex;
    gap: 4px;
    padding: 8px 0;
  }
  .dots span {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text-muted);
    animation: dot-bounce 1.2s ease-in-out infinite;
  }
  .dots span:nth-child(2) { animation-delay: 0.2s; }
  .dots span:nth-child(3) { animation-delay: 0.4s; }

  @keyframes dot-bounce {
    0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
    40% { transform: scale(1); opacity: 1; }
  }

  /* Input bar */
  .input-bar {
    border-top: 1px solid var(--border-subtle);
    padding: 16px 24px max(16px, env(safe-area-inset-bottom, 16px));
    background: var(--bg-primary);
  }

  .input-inner {
    max-width: 640px;
    margin: 0 auto;
    display: flex;
    align-items: flex-end;
    gap: 8px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 8px 8px 8px 16px;
    transition: border-color 0.2s;
  }

  .input-inner:focus-within {
    border-color: var(--border-strong);
  }

  .input-field {
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-size: 15px;
    font-family: inherit;
    line-height: 1.5;
    resize: none;
    padding: 6px 0;
    max-height: 160px;
  }

  .input-field::placeholder {
    color: var(--text-muted);
  }

  .input-field:disabled {
    opacity: 0.5;
  }

  .send-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: none;
    background: var(--accent-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 0.15s, transform 0.15s;
  }

  .send-btn:hover { opacity: 0.9; }
  .send-btn:active { transform: scale(0.93); }
  .send-btn:disabled { opacity: 0.3; cursor: default; }
</style>
