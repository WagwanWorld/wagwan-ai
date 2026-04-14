<script lang="ts">
  import { createEventDispatcher, onMount, tick } from 'svelte';

  export let brandContext: { brandName: string; website: string; instagram: string; description: string };

  type Choice = { label: string; value: string };
  type QA = {
    question: string;
    choices: Choice[] | null;
    answer: string | null;
  };

  const dispatch = createEventDispatcher<{
    thinking: { step: string; text: string };
    matches: { results: unknown };
    brief: { brief: unknown };
    done: { agentText: string };
  }>();

  let qaHistory: QA[] = [];
  let currentQuestion = '';
  let currentChoices: Choice[] | null = null;
  let customInput = '';
  let loading = false;
  let scrollEl: HTMLDivElement;
  let questionCount = 0;

  let messageHistory: Array<{ role: 'user' | 'agent'; text: string }> = [];

  async function scrollToBottom() {
    await tick();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  onMount(() => {
    const primer = `Brand: ${brandContext.brandName || 'unnamed'}. We sell: ${brandContext.description}.${brandContext.website ? ` Website: ${brandContext.website}.` : ''}${brandContext.instagram ? ` Instagram: @${brandContext.instagram}.` : ''}`;
    sendMessage(primer);
  });

  async function sendMessage(text: string) {
    loading = true;

    if (currentQuestion) {
      qaHistory = [...qaHistory, { question: currentQuestion, choices: currentChoices, answer: text }];
      currentQuestion = '';
      currentChoices = null;
      questionCount++;
    }

    messageHistory = [...messageHistory, { role: 'user', text }];
    await scrollToBottom();

    try {
      const res = await fetch('/api/brand/match-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messageHistory.slice(0, -1),
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let agentText = '';
      let buffer = '';
      let receivedChoices: Choice[] | null = null;

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
              currentQuestion = agentText;
              await scrollToBottom();
            } else if (eventType === 'message' && data.text) {
              agentText = data.text;
              currentQuestion = agentText;
            } else if (eventType === 'choices' && data.choices) {
              receivedChoices = data.choices;
              currentChoices = receivedChoices;
            } else if (eventType === 'status') {
              dispatch('thinking', { step: data.step, text: data.text });
            } else if (eventType === 'matches') {
              dispatch('matches', { results: data.results });
            } else if (eventType === 'brief') {
              dispatch('brief', { brief: data.brief });
            }
          } catch {}
        }
      }

      messageHistory = [...messageHistory, { role: 'agent', text: agentText }];

      if (!receivedChoices) {
        currentChoices = null;
      }

      await scrollToBottom();
    } catch {
      currentQuestion = 'Something went wrong. Please try again.';
      currentChoices = [{ label: 'Retry', value: '__retry__' }];
    } finally {
      loading = false;
    }
  }

  function selectChoice(choice: Choice) {
    if (choice.value === '__custom__') {
      currentChoices = currentChoices;
      return;
    }
    if (choice.value === '__retry__') {
      const lastUserMsg = messageHistory.filter(m => m.role === 'user').pop();
      if (lastUserMsg) {
        messageHistory = messageHistory.slice(0, -2);
        sendMessage(lastUserMsg.text);
      }
      return;
    }
    sendMessage(choice.label);
  }

  function submitCustom() {
    const text = customInput.trim();
    if (!text) return;
    customInput = '';
    sendMessage(text);
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitCustom();
    }
  }
</script>

<div class="gq-root" bind:this={scrollEl}>
  <div class="gq-inner">
    <!-- Progress dots -->
    <div class="progress-dots">
      {#each Array(Math.max(6, questionCount + 1)) as _, i}
        <div
          class="dot"
          class:dot--done={i < questionCount}
          class:dot--active={i === questionCount && !loading}
        ></div>
      {/each}
    </div>

    <!-- Answered questions (faded, compact) -->
    {#each qaHistory as qa, i}
      <div class="qa-answered" style="animation-delay: {i * 0.05}s">
        <p class="qa-q-done">{qa.question}</p>
        <span class="qa-a-chip">{qa.answer}</span>
      </div>
    {/each}

    <!-- Current question -->
    {#if currentQuestion}
      <div class="qa-current" class:qa-current--loading={loading}>
        <p class="qa-question">{currentQuestion}</p>

        {#if loading}
          <div class="dots">
            <span></span><span></span><span></span>
          </div>
        {:else if currentChoices && currentChoices.length > 0}
          <div class="chips-container">
            {#each currentChoices as choice}
              {#if choice.value !== '__custom__'}
                <button class="chip" on:click={() => selectChoice(choice)}>
                  {choice.label}
                </button>
              {/if}
            {/each}
          </div>

          <div class="custom-row">
            <input
              type="text"
              bind:value={customInput}
              on:keydown={handleKeydown}
              class="custom-input"
              placeholder="Type your own answer..."
            />
            <button
              class="custom-send"
              on:click={submitCustom}
              disabled={!customInput.trim()}
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        {:else}
          <!-- No chips — show text input for confirmation/freeform -->
          <div class="custom-row">
            <input
              type="text"
              bind:value={customInput}
              on:keydown={handleKeydown}
              class="custom-input"
              placeholder="Type your response..."
            />
            <button
              class="custom-send"
              on:click={submitCustom}
              disabled={!customInput.trim()}
              aria-label="Send"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none">
                <path d="M3 9h12M10 4l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        {/if}
      </div>
    {:else if loading}
      <div class="qa-current qa-current--loading">
        <div class="dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .gq-root {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    scrollbar-width: none;
  }
  .gq-root::-webkit-scrollbar { display: none; }

  .gq-inner {
    max-width: 540px;
    margin: 0 auto;
    padding: 48px 24px 120px;
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 32px;
  }

  .progress-dots {
    display: flex;
    gap: 6px;
    justify-content: center;
    padding-bottom: 8px;
  }

  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--glass-medium);
    transition: background 0.3s, transform 0.3s;
  }

  .dot--done {
    background: var(--accent-primary);
    transform: scale(0.85);
  }

  .dot--active {
    background: var(--accent-primary);
    animation: dot-pulse 1.5s ease-in-out infinite;
  }

  @keyframes dot-pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
  }

  .qa-answered {
    display: flex;
    flex-direction: column;
    gap: 6px;
    opacity: 0.45;
    animation: fade-up 0.3s ease-out both;
  }

  @keyframes fade-up {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 0.45; transform: translateY(0); }
  }

  .qa-q-done {
    font-size: 13px;
    color: var(--text-muted);
    margin: 0;
    line-height: 1.4;
  }

  .qa-a-chip {
    display: inline-block;
    align-self: flex-start;
    background: var(--glass-medium);
    border-radius: 8px;
    padding: 4px 12px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .qa-current {
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: fade-in 0.4s ease-out;
  }

  .qa-current--loading {
    opacity: 0.7;
  }

  @keyframes fade-in {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .qa-question {
    font-size: 18px;
    font-weight: 500;
    line-height: 1.5;
    color: var(--text-primary);
    margin: 0;
  }

  .chips-container {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .chip {
    background: var(--glass-medium);
    border: 1px solid var(--border-subtle);
    border-radius: 20px;
    padding: 8px 18px;
    font-size: 14px;
    color: var(--text-primary);
    font-family: inherit;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, transform 0.1s;
  }

  .chip:hover {
    background: var(--glass-strong);
    border-color: var(--border-strong);
  }

  .chip:active {
    transform: scale(0.96);
  }

  .custom-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .custom-input {
    flex: 1;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 8px 14px;
    font-size: 14px;
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .custom-input:focus {
    border-color: var(--accent-primary);
  }

  .custom-input::placeholder {
    color: var(--text-muted);
  }

  .custom-send {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: none;
    background: var(--accent-primary);
    color: white;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: opacity 0.15s;
  }

  .custom-send:hover { opacity: 0.9; }
  .custom-send:disabled { opacity: 0.3; cursor: default; }

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
</style>
