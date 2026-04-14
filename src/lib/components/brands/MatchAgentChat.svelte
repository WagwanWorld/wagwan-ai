<script lang="ts">
  import { onMount, tick } from 'svelte';

  type Message = { role: 'user' | 'agent'; text: string };

  let messages: Message[] = [];
  let input = '';
  let loading = false;
  let chatEl: HTMLDivElement;

  async function scrollToBottom() {
    await tick();
    if (chatEl) chatEl.scrollTop = chatEl.scrollHeight;
  }

  onMount(() => {
    // Agent opens the conversation
    messages = [{ role: 'agent', text: 'Tell me about what you\'re trying to sell and who buys it.' }];
  });

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    input = '';
    messages = [...messages, { role: 'user', text }];
    loading = true;
    await scrollToBottom();

    try {
      const res = await fetch('/api/brand/match-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messages.slice(0, -1), // exclude the message we just added
        }),
      });

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No stream');
      const decoder = new TextDecoder();
      let agentText = '';
      let carry = '';

      // Add placeholder for agent response
      messages = [...messages, { role: 'agent', text: '' }];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        carry += decoder.decode(value, { stream: true });
        const lines = carry.split('\n');
        carry = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              // Check what event this is from the preceding event: line
            } catch {}
          }
          if (line.startsWith('event: text_delta')) {
            // Next data line has the delta
          }
        }

        // Simpler approach: parse all SSE events
        const events = carry.split('\n\n');
        carry = events.pop() ?? '';
        for (const ev of events) {
          const eventMatch = ev.match(/event: (\w+)\ndata: (.*)/s);
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
          } catch {}
        }
      }

      // Ensure final message is set
      if (agentText) {
        messages = [...messages.slice(0, -1), { role: 'agent', text: agentText }];
      }
    } catch (e) {
      messages = [...messages, { role: 'agent', text: 'Something went wrong. Please try again.' }];
    } finally {
      loading = false;
      await scrollToBottom();
    }
  }
</script>

<div class="mac-root">
  <div class="mac-messages" bind:this={chatEl}>
    {#each messages as msg}
      <div class="mac-msg" class:mac-msg--user={msg.role === 'user'} class:mac-msg--agent={msg.role === 'agent'}>
        <p class="mac-msg-text">{msg.text}</p>
      </div>
    {/each}
    {#if loading}
      <div class="mac-msg mac-msg--agent">
        <p class="mac-msg-text mac-typing">Thinking...</p>
      </div>
    {/if}
  </div>
  <form class="mac-input-row" on:submit|preventDefault={send}>
    <input
      type="text"
      class="mac-input"
      bind:value={input}
      placeholder="Describe your product, audience, or campaign goals..."
      disabled={loading}
    />
    <button class="mac-send" type="submit" disabled={loading || !input.trim()}>Send</button>
  </form>
</div>

<style>
  .mac-root {
    display: flex; flex-direction: column; height: 100%;
    background: var(--bg-primary); border-radius: 16px;
    border: 1px solid var(--border-subtle); overflow: hidden;
  }
  .mac-messages {
    flex: 1; overflow-y: auto; padding: 24px;
    display: flex; flex-direction: column; gap: 16px;
    scrollbar-width: none;
  }
  .mac-messages::-webkit-scrollbar { display: none; }

  .mac-msg { max-width: 85%; }
  .mac-msg--user { align-self: flex-end; }
  .mac-msg--agent { align-self: flex-start; }

  .mac-msg-text {
    padding: 12px 16px; border-radius: 14px; margin: 0;
    font-size: 14px; line-height: 1.5; color: var(--text-primary);
    white-space: pre-wrap;
  }
  .mac-msg--user .mac-msg-text {
    background: linear-gradient(135deg, rgba(255,77,77,0.15), rgba(255,184,77,0.1));
    border: 1px solid rgba(255,77,77,0.2);
    border-radius: 14px 14px 4px 14px;
  }
  .mac-msg--agent .mac-msg-text {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px 14px 14px 4px;
  }

  .mac-typing { color: var(--text-muted); font-style: italic; }

  .mac-input-row {
    display: flex; gap: 8px; padding: 16px;
    border-top: 1px solid var(--border-subtle);
    background: var(--glass-light);
  }
  .mac-input {
    flex: 1; padding: 12px 16px; border-radius: 12px;
    background: var(--bg-primary); border: 1px solid var(--border-subtle);
    color: var(--text-primary); font-size: 14px; font-family: inherit;
    outline: none;
  }
  .mac-input:focus { border-color: var(--accent-primary); }
  .mac-input::placeholder { color: var(--text-muted); }
  .mac-input:disabled { opacity: 0.5; }

  .mac-send {
    padding: 12px 20px; border-radius: 12px; border: none;
    background: linear-gradient(135deg, #FF4D4D, #FFB84D);
    color: white; font-size: 14px; font-weight: 700; font-family: inherit;
    cursor: pointer; transition: transform 0.15s;
  }
  .mac-send:active { transform: scale(0.97); }
  .mac-send:disabled { opacity: 0.4; cursor: default; }
</style>
