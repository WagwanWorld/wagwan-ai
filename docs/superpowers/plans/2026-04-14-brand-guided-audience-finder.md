# Brand Guided Audience Finder — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the text-heavy brand portal chat with a 4-step guided flow: intake card, AI-driven chip questions, thinking stepper, and action-first results dashboard.

**Architecture:** The portal page (`+page.svelte`) becomes a step orchestrator managing 4 child components. The match-agent API is modified to return structured `choices` alongside each question. All creator scoring/matching logic stays unchanged.

**Tech Stack:** SvelteKit, Claude Haiku (Anthropic SDK), SSE streaming, CSS custom properties (existing design token system)

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/lib/components/brands/BrandIntakeCard.svelte` | Step 1 — brand info form (name, website, IG, description) |
| Create | `src/lib/components/brands/GuidedQuestions.svelte` | Step 2 — renders AI questions with clickable chip answers |
| Create | `src/lib/components/brands/ThinkingStepper.svelte` | Step 3 — animated progress stepper during matching |
| Create | `src/lib/components/brands/ResultsDashboard.svelte` | Step 4 — summary cards, selectable creator grid, sticky action bar |
| Modify | `src/lib/server/marketplace/brandMatchAgent.ts` | Update system prompt to return structured choices |
| Modify | `src/routes/api/brand/match-agent/+server.ts` | Parse choices from AI response, emit `choices` SSE event |
| Modify | `src/routes/brands/portal/+page.svelte` | Orchestrate 4-step flow, manage step transitions |

---

### Task 1: Update System Prompt to Return Structured Choices

**Files:**
- Modify: `src/lib/server/marketplace/brandMatchAgent.ts:58-113`

- [ ] **Step 1: Add choice format instructions to the system prompt**

In `brandMatchAgent.ts`, replace the `BRAND_MATCH_SYSTEM_PROMPT` export. The key change is adding a `RESPONSE FORMAT` section that instructs the AI to embed JSON choices in each question. The rest of the prompt stays identical.

Add this section right before `HARD RULES:` (before line 107):

```typescript
// In the BRAND_MATCH_SYSTEM_PROMPT string, add before "HARD RULES:":

RESPONSE FORMAT:
Every question you ask MUST end with a JSON block on its own line, fenced as:
\`\`\`choices
[{"label": "Short display text", "value": "the full answer value"}, ...]
\`\`\`
Include 3-5 choices per question. The last choice should always be {"label": "Something else", "value": "__custom__"} so the user can type their own answer.
Example:
"What's your main campaign goal?"
\`\`\`choices
[{"label": "Get seen by the right people", "value": "awareness"}, {"label": "Build trust and credibility", "value": "trust"}, {"label": "Drive purchases", "value": "conversion"}, {"label": "Something else", "value": "__custom__"}]
\`\`\`
Never put choices in the middle of your message — always at the end, after all text.
Do NOT include choices when you are confirming the brief (Phase 4) or delivering results (Phase 5+). Only during questioning phases.
```

- [ ] **Step 2: Verify the prompt compiles**

Run: `npm run check`
Expected: No TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/marketplace/brandMatchAgent.ts
git commit -m "feat(brand-agent): add structured choices format to system prompt"
```

---

### Task 2: Parse Choices and Emit SSE Event in API

**Files:**
- Modify: `src/routes/api/brand/match-agent/+server.ts:70-76`

- [ ] **Step 1: Add a `parseChoices` helper and modify text processing**

At the top of the file (after imports, before `const anthropic`), add a helper function to extract choices from agent text:

```typescript
type Choice = { label: string; value: string };

function parseChoices(text: string): { cleanText: string; choices: Choice[] | null } {
  const choicesRegex = /```choices\n(\[[\s\S]*?\])\n```/;
  const match = text.match(choicesRegex);
  if (!match) return { cleanText: text, choices: null };

  const cleanText = text.replace(choicesRegex, '').trimEnd();
  try {
    const choices = JSON.parse(match[1]) as Choice[];
    return { cleanText, choices };
  } catch {
    return { cleanText: text, choices: null };
  }
}
```

- [ ] **Step 2: Modify text block processing to extract and emit choices**

In the `start(controller)` function, everywhere there's a `block.type === 'text'` handler that does:
```typescript
agentText += block.text;
controller.enqueue(sse('text_delta', { delta: block.text }));
```

Replace with:
```typescript
const { cleanText, choices } = parseChoices(block.text);
agentText += cleanText;
controller.enqueue(sse('text_delta', { delta: cleanText }));
if (choices) {
  controller.enqueue(sse('choices', { choices }));
}
```

Apply this same change to all `fb.type === 'text'` handlers inside the tool follow-up blocks (there are 3 — inside `extract_brand_brief`, `run_creator_match`, and `generate_outreach_brief` follow-ups). In total there are 4 places to change (lines ~73-75, ~98-100, ~129-131, ~153-155).

- [ ] **Step 3: Also emit `status` events for the thinking stepper**

Add a status event when `extract_brand_brief` tool is called (before the existing brief event on line ~82):

```typescript
controller.enqueue(sse('status', { step: 'brief', text: 'Understanding your brand...' }));
```

Add a status event at the start of `run_creator_match` (before the existing status event on line ~104):

```typescript
controller.enqueue(sse('status', { step: 'scoring', text: 'Analyzing creator signals...' }));
```

Change the existing status line `controller.enqueue(sse('status', { text: 'Scoring creators...' }));` to:

```typescript
controller.enqueue(sse('status', { step: 'matching', text: 'Matching to your audience...' }));
```

After match results are sent (after the `controller.enqueue(sse('matches', { results }));` line), add:

```typescript
controller.enqueue(sse('status', { step: 'done', text: 'Building your campaign plan...' }));
```

- [ ] **Step 4: Verify the API compiles**

Run: `npm run check`
Expected: No TypeScript errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/api/brand/match-agent/+server.ts
git commit -m "feat(brand-agent): parse choices from AI response and emit structured SSE events"
```

---

### Task 3: Build the BrandIntakeCard Component

**Files:**
- Create: `src/lib/components/brands/BrandIntakeCard.svelte`

- [ ] **Step 1: Create the intake card component**

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{
    submit: { brandName: string; website: string; instagram: string; description: string };
  }>();

  let brandName = '';
  let website = '';
  let instagram = '';
  let description = '';
  let submitting = false;

  function handleSubmit() {
    if (!description.trim()) return;
    submitting = true;
    dispatch('submit', {
      brandName: brandName.trim(),
      website: website.trim(),
      instagram: instagram.trim().replace(/^@/, ''),
      description: description.trim(),
    });
  }
</script>

<div class="intake-backdrop">
  <form class="intake-card" on:submit|preventDefault={handleSubmit}>
    <h1 class="intake-title">Find your audience</h1>
    <p class="intake-sub">Tell us about your brand. We'll match you to the right creators.</p>

    <div class="intake-fields">
      <div class="field">
        <label for="brand-name">Brand name</label>
        <input id="brand-name" type="text" bind:value={brandName} placeholder="Acme Co" />
      </div>

      <div class="field">
        <label for="website">Website</label>
        <input id="website" type="url" bind:value={website} placeholder="https://acme.com" />
      </div>

      <div class="field">
        <label for="instagram">Instagram</label>
        <div class="ig-input">
          <span class="ig-at">@</span>
          <input id="instagram" type="text" bind:value={instagram} placeholder="acmeco" />
        </div>
      </div>

      <div class="field">
        <label for="description">What do you sell? <span class="required">*</span></label>
        <input
          id="description"
          type="text"
          bind:value={description}
          placeholder="Sustainable sneakers for urban runners"
          required
        />
      </div>
    </div>

    <button class="intake-btn" type="submit" disabled={!description.trim() || submitting}>
      {#if submitting}
        <span class="spinner"></span>
      {:else}
        Find My Audience
      {/if}
    </button>
  </form>
</div>

<style>
  .intake-backdrop {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: 24px;
  }

  .intake-card {
    width: 100%;
    max-width: 420px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  .intake-title {
    font-size: clamp(24px, 4vw, 32px);
    font-weight: 600;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin: 0;
    text-align: center;
  }

  .intake-sub {
    font-size: 14px;
    color: var(--text-muted);
    text-align: center;
    margin: -16px 0 0;
    line-height: 1.5;
  }

  .intake-fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field label {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .required {
    color: var(--accent-primary);
  }

  .field input {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 14px;
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
    transition: border-color 0.2s;
  }

  .field input:focus {
    border-color: var(--accent-primary);
  }

  .field input::placeholder {
    color: var(--text-muted);
  }

  .ig-input {
    display: flex;
    align-items: center;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 10px;
    transition: border-color 0.2s;
  }

  .ig-input:focus-within {
    border-color: var(--accent-primary);
  }

  .ig-at {
    padding: 0 0 0 14px;
    color: var(--text-muted);
    font-size: 14px;
    user-select: none;
  }

  .ig-input input {
    background: transparent;
    border: none;
    border-radius: 0;
    padding-left: 2px;
  }

  .ig-input input:focus {
    border-color: transparent;
  }

  .intake-btn {
    width: 100%;
    padding: 12px;
    border: none;
    border-radius: 12px;
    background: var(--accent-primary);
    color: white;
    font-size: 15px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 44px;
  }

  .intake-btn:hover:not(:disabled) { opacity: 0.9; }
  .intake-btn:active:not(:disabled) { transform: scale(0.98); }
  .intake-btn:disabled { opacity: 0.4; cursor: default; }

  .spinner {
    width: 18px;
    height: 18px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/brands/BrandIntakeCard.svelte
git commit -m "feat(brands): add BrandIntakeCard component for step 1 intake form"
```

---

### Task 4: Build the GuidedQuestions Component

**Files:**
- Create: `src/lib/components/brands/GuidedQuestions.svelte`

- [ ] **Step 1: Create the guided questions component**

This component replaces `MatchAgentChat.svelte`. It sends messages to the same `/api/brand/match-agent` endpoint but renders AI responses as question text + clickable chips instead of chat bubbles. It also listens for `status` events to signal the parent to transition to the stepper.

```svelte
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

  // Conversation history for the API (flat messages list)
  let messageHistory: Array<{ role: 'user' | 'agent'; text: string }> = [];

  async function scrollToBottom() {
    await tick();
    if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  onMount(() => {
    // Send the brand context as the first message to prime the agent
    const primer = `Brand: ${brandContext.brandName || 'unnamed'}. We sell: ${brandContext.description}.${brandContext.website ? ` Website: ${brandContext.website}.` : ''}${brandContext.instagram ? ` Instagram: @${brandContext.instagram}.` : ''}`;
    sendMessage(primer);
  });

  async function sendMessage(text: string) {
    loading = true;

    // Store the answer on the current Q if there is one
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
        // No choices means agent is in confirmation/results phase — just show text
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
      // Focus the custom input — don't send yet
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

          <!-- Always show custom input -->
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

  /* Progress dots */
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

  /* Answered Q&A */
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

  /* Current question */
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

  /* Chips */
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

  /* Custom input */
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
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/brands/GuidedQuestions.svelte
git commit -m "feat(brands): add GuidedQuestions component with chip-based AI Q&A"
```

---

### Task 5: Build the ThinkingStepper Component

**Files:**
- Create: `src/lib/components/brands/ThinkingStepper.svelte`

- [ ] **Step 1: Create the thinking stepper component**

```svelte
<script lang="ts">
  export let steps: Array<{ key: string; label: string }> = [
    { key: 'brief', label: 'Understanding your brand' },
    { key: 'scoring', label: 'Analyzing creator signals' },
    { key: 'matching', label: 'Matching to your audience' },
    { key: 'done', label: 'Building your campaign plan' },
  ];

  export let activeStep: string = '';
  export let completedSteps: Set<string> = new Set();

  $: activeIdx = steps.findIndex(s => s.key === activeStep);
</script>

<div class="stepper-root">
  <div class="stepper-card">
    <h2 class="stepper-title">Finding your audience</h2>

    <div class="stepper-list">
      {#each steps as step, i}
        {@const isDone = completedSteps.has(step.key)}
        {@const isActive = step.key === activeStep}
        <div
          class="step"
          class:step--done={isDone}
          class:step--active={isActive}
          style="animation-delay: {i * 0.15}s"
        >
          <div class="step-indicator">
            {#if isDone}
              <svg class="check-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8.5l3.5 3.5L13 4" stroke="var(--accent-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            {:else if isActive}
              <div class="step-spinner"></div>
            {:else}
              <div class="step-dot"></div>
            {/if}
          </div>
          <span class="step-label">{step.label}{isDone ? '' : '...'}</span>
        </div>
      {/each}
    </div>
  </div>
</div>

<style>
  .stepper-root {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
    padding: 24px;
  }

  .stepper-card {
    display: flex;
    flex-direction: column;
    gap: 32px;
    max-width: 360px;
    width: 100%;
  }

  .stepper-title {
    font-size: 20px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    text-align: center;
    letter-spacing: -0.01em;
  }

  .stepper-list {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .step {
    display: flex;
    align-items: center;
    gap: 14px;
    opacity: 0.35;
    transition: opacity 0.4s ease;
    animation: step-in 0.4s ease-out both;
  }

  .step--done {
    opacity: 0.6;
  }

  .step--active {
    opacity: 1;
  }

  @keyframes step-in {
    from { opacity: 0; transform: translateX(-8px); }
    to { transform: translateX(0); }
  }

  .step-indicator {
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .step-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--glass-strong);
  }

  .step-spinner {
    width: 18px;
    height: 18px;
    border: 2px solid var(--glass-strong);
    border-top-color: var(--accent-primary);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .check-icon {
    animation: check-pop 0.3s ease-out;
  }

  @keyframes check-pop {
    from { transform: scale(0); }
    50% { transform: scale(1.2); }
    to { transform: scale(1); }
  }

  .step-label {
    font-size: 15px;
    color: var(--text-primary);
    line-height: 1.3;
  }

  .step--done .step-label {
    color: var(--text-secondary);
  }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/brands/ThinkingStepper.svelte
git commit -m "feat(brands): add ThinkingStepper component for step 3 progress animation"
```

---

### Task 6: Build the ResultsDashboard Component

**Files:**
- Create: `src/lib/components/brands/ResultsDashboard.svelte`

- [ ] **Step 1: Create the results dashboard component**

This component takes the match results and renders summary cards, a selectable creator grid, and a sticky action bar.

```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  type MatchedCreator = {
    creator: {
      google_sub: string;
      name: string;
      handle: string;
      follower_count: number;
      content_themes: string[];
      location: string;
      rates: { ig_post_rate_inr: number; ig_story_rate_inr: number; ig_reel_rate_inr: number; available: boolean } | null;
      graph_strength: number;
    };
    score: number;
    reasoning: string;
    watch_out: string;
  };

  export let matches: MatchedCreator[] = [];
  export let brandName: string = '';

  const dispatch = createEventDispatcher<{
    startCampaign: { selected: string[] };
    startOver: void;
  }>();

  let selected = new Set<string>(matches.slice(0, Math.min(5, matches.length)).map(m => m.creator.google_sub));

  $: totalReach = matches
    .filter(m => selected.has(m.creator.google_sub))
    .reduce((sum, m) => sum + m.creator.follower_count, 0);

  $: estimatedCost = matches
    .filter(m => selected.has(m.creator.google_sub))
    .reduce((sum, m) => {
      const rate = m.creator.rates?.ig_post_rate_inr ?? 0;
      return sum + rate;
    }, 0);

  $: selectedCount = selected.size;

  function toggleCreator(sub: string) {
    const next = new Set(selected);
    if (next.has(sub)) next.delete(sub);
    else next.add(sub);
    selected = next;
  }

  function formatNumber(n: number): string {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
    if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
    return n.toString();
  }

  function formatINR(n: number): string {
    if (n === 0) return 'Free';
    return '₹' + n.toLocaleString('en-IN');
  }

  function initials(name: string): string {
    const p = name.trim().split(/\s+/).filter(Boolean);
    if (!p.length) return '?';
    if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
    return (p[0][0] + p[p.length - 1][0]).toUpperCase();
  }

  function tileGradient(seed: string): string {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
    const hue = Math.abs(h) % 360;
    const h2 = (hue + 38) % 360;
    return `linear-gradient(145deg, hsl(${hue}, 42%, 18%), hsl(${h2}, 36%, 10%))`;
  }

  // Derive a strategy label from match data
  $: strategyLabel = (() => {
    const avgScore = matches.reduce((s, m) => s + m.score, 0) / (matches.length || 1);
    if (avgScore >= 75) return 'High-affinity creator seeding';
    if (matches.length <= 5) return 'Focused micro-creator push';
    return 'Broad awareness campaign';
  })();
</script>

<div class="results-root">
  <!-- Summary cards -->
  <div class="summary-row">
    <div class="summary-card">
      <span class="summary-value">{formatNumber(totalReach)}</span>
      <span class="summary-label">Total Reach</span>
    </div>
    <div class="summary-card">
      <span class="summary-value">{matches.length}</span>
      <span class="summary-label">Matched Creators</span>
    </div>
    <div class="summary-card">
      <span class="summary-value">{formatINR(estimatedCost)}</span>
      <span class="summary-label">Estimated Cost</span>
    </div>
    <div class="summary-card summary-card--accent">
      <span class="summary-value summary-value--small">{strategyLabel}</span>
      <span class="summary-label">Recommended Strategy</span>
    </div>
  </div>

  <!-- Creator grid -->
  <div class="grid-header">
    <h3 class="grid-title">Your creators</h3>
    <button class="text-btn" on:click={() => dispatch('startOver')}>Start over</button>
  </div>

  <div class="creator-grid">
    {#each matches as match}
      {@const c = match.creator}
      {@const isSelected = selected.has(c.google_sub)}
      <button
        class="creator-card"
        class:creator-card--selected={isSelected}
        on:click={() => toggleCreator(c.google_sub)}
      >
        <div class="card-check" class:card-check--on={isSelected}>
          {#if isSelected}
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5l3.5 3.5L13 4" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
          {/if}
        </div>

        <div class="card-avatar" style="background: {tileGradient(c.google_sub)}">
          <span>{initials(c.name)}</span>
        </div>

        <div class="card-info">
          <span class="card-name">{c.name}</span>
          <span class="card-handle">@{c.handle}</span>
        </div>

        <div class="card-meta">
          <span class="card-score">{match.score}% match</span>
          <span class="card-followers">{formatNumber(c.follower_count)}</span>
        </div>

        <p class="card-reason">{match.reasoning}</p>

        <div class="card-tags">
          {#each c.content_themes.slice(0, 3) as tag}
            <span class="tag">{tag}</span>
          {/each}
        </div>
      </button>
    {/each}
  </div>

  <!-- Sticky action bar -->
  {#if selectedCount > 0}
    <div class="action-bar">
      <div class="action-info">
        <span class="action-count">{selectedCount} selected</span>
        <span class="action-sep">·</span>
        <span class="action-cost">{formatINR(estimatedCost)}</span>
      </div>
      <button class="action-btn" on:click={() => dispatch('startCampaign', { selected: [...selected] })}>
        Start Campaign
      </button>
    </div>
  {/if}
</div>

<style>
  .results-root {
    max-width: 800px;
    margin: 0 auto;
    padding: 32px 24px 120px;
    display: flex;
    flex-direction: column;
    gap: 28px;
  }

  /* Summary cards */
  .summary-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }

  .summary-card {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    padding: 18px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .summary-card--accent {
    border-color: var(--accent-primary);
    background: var(--accent-soft);
  }

  .summary-value {
    font-size: 24px;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
  }

  .summary-value--small {
    font-size: 14px;
    font-weight: 600;
    line-height: 1.3;
  }

  .summary-label {
    font-size: 12px;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Grid header */
  .grid-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .grid-title {
    font-size: 16px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .text-btn {
    background: none;
    border: none;
    color: var(--text-muted);
    font-size: 13px;
    font-family: inherit;
    cursor: pointer;
    padding: 4px 8px;
    border-radius: 6px;
    transition: color 0.15s;
  }

  .text-btn:hover {
    color: var(--text-primary);
  }

  /* Creator grid */
  .creator-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  .creator-card {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: inherit;
    transition: border-color 0.2s, background 0.2s;
    position: relative;
  }

  .creator-card:hover {
    border-color: var(--border-strong);
    background: var(--glass-medium);
  }

  .creator-card--selected {
    border-color: var(--accent-primary);
    background: var(--accent-soft);
  }

  .card-check {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 20px;
    height: 20px;
    border-radius: 6px;
    border: 1.5px solid var(--border-strong);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s, border-color 0.15s;
  }

  .card-check--on {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
  }

  .card-avatar {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    color: rgba(255,255,255,0.8);
  }

  .card-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .card-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .card-handle {
    font-size: 12px;
    color: var(--text-muted);
  }

  .card-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .card-score {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent-primary);
  }

  .card-followers {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .card-reason {
    font-size: 12px;
    color: var(--text-secondary);
    line-height: 1.4;
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .tag {
    font-size: 11px;
    background: var(--glass-medium);
    border-radius: 6px;
    padding: 2px 8px;
    color: var(--text-muted);
  }

  /* Sticky action bar */
  .action-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: var(--bg-elevated);
    border-top: 1px solid var(--border-subtle);
    padding: 14px 24px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 100;
    animation: slide-up 0.3s ease-out;
  }

  @keyframes slide-up {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  .action-info {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    color: var(--text-secondary);
  }

  .action-count {
    font-weight: 600;
    color: var(--text-primary);
  }

  .action-sep {
    color: var(--text-muted);
  }

  .action-btn {
    background: var(--accent-primary);
    color: white;
    border: none;
    border-radius: 10px;
    padding: 10px 24px;
    font-size: 14px;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    transition: opacity 0.15s, transform 0.15s;
  }

  .action-btn:hover { opacity: 0.9; }
  .action-btn:active { transform: scale(0.97); }
</style>
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run check`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/brands/ResultsDashboard.svelte
git commit -m "feat(brands): add ResultsDashboard component with summary cards and selectable grid"
```

---

### Task 7: Rewire the Portal Page as 4-Step Orchestrator

**Files:**
- Modify: `src/routes/brands/portal/+page.svelte`

This is the biggest change. The portal page needs to manage 4 steps and transition between them. We keep the existing manual search and campaign panel logic but wrap the primary flow in a step machine.

- [ ] **Step 1: Add new imports and step state at the top of the script block**

Replace lines 1-10 (the existing imports) with:

```svelte
<script lang="ts">
  import { goto, invalidateAll } from '$app/navigation';
  import { onMount } from 'svelte';
  import BrandIntakeCard from '$lib/components/brands/BrandIntakeCard.svelte';
  import GuidedQuestions from '$lib/components/brands/GuidedQuestions.svelte';
  import ThinkingStepper from '$lib/components/brands/ThinkingStepper.svelte';
  import ResultsDashboard from '$lib/components/brands/ResultsDashboard.svelte';
  import ArrowRight from 'phosphor-svelte/lib/ArrowRight';
  import Download from 'phosphor-svelte/lib/Download';
  import SignOut from 'phosphor-svelte/lib/SignOut';
  import Sparkle from 'phosphor-svelte/lib/Sparkle';
  import Note from 'phosphor-svelte/lib/Note';
  import X from 'phosphor-svelte/lib/X';
```

After the existing `export let data` line, add the new step machine state:

```typescript
  // ── Step machine ──
  type Step = 'intake' | 'questions' | 'thinking' | 'results';
  let currentStep: Step = 'intake';

  let brandContext = { brandName: '', website: '', instagram: '', description: '' };

  // Thinking stepper state
  let thinkingActiveStep = '';
  let thinkingCompleted = new Set<string>();

  // Results from match agent
  let matchResults: Array<{
    creator: {
      google_sub: string;
      name: string;
      handle: string;
      follower_count: number;
      content_themes: string[];
      location: string;
      rates: { ig_post_rate_inr: number; ig_story_rate_inr: number; ig_reel_rate_inr: number; available: boolean } | null;
      graph_strength: number;
    };
    score: number;
    reasoning: string;
    watch_out: string;
  }> = [];

  function handleIntakeSubmit(e: CustomEvent<typeof brandContext>) {
    brandContext = e.detail;
    brandName = brandContext.brandName || 'Your brand';
    currentStep = 'questions';
  }

  function handleThinking(e: CustomEvent<{ step: string; text: string }>) {
    if (currentStep !== 'thinking') {
      currentStep = 'thinking';
    }
    // Mark previous step as done, set new one active
    if (thinkingActiveStep) {
      thinkingCompleted = new Set([...thinkingCompleted, thinkingActiveStep]);
    }
    thinkingActiveStep = e.detail.step;

    if (e.detail.step === 'done') {
      thinkingCompleted = new Set([...thinkingCompleted, 'done']);
      // Transition to results after a short delay
      setTimeout(() => {
        currentStep = 'results';
      }, 800);
    }
  }

  function handleMatches(e: CustomEvent<{ results: { matches: typeof matchResults } }>) {
    const data = e.detail;
    matchResults = data?.results?.matches ?? [];
  }

  function handleStartOver() {
    currentStep = 'intake';
    brandContext = { brandName: '', website: '', instagram: '', description: '' };
    thinkingActiveStep = '';
    thinkingCompleted = new Set();
    matchResults = [];
  }
```

- [ ] **Step 2: Replace the main template (the `{#if !data.brandSessionValid}` / `{:else}` block) with the step flow**

Find the main content area in the template. The current structure has a tab bar (Audience / Campaigns) and then either `MatchAgentChat` or the manual search. Replace the chat portion with the step-based flow.

Locate the section that renders `<MatchAgentChat />` and the surrounding area (the `main-content` div or similar). Replace that content block with:

```svelte
    {#if currentStep === 'intake'}
      <BrandIntakeCard on:submit={handleIntakeSubmit} />
    {:else if currentStep === 'questions'}
      <GuidedQuestions
        {brandContext}
        on:thinking={handleThinking}
        on:matches={handleMatches}
      />
    {:else if currentStep === 'thinking'}
      <ThinkingStepper
        activeStep={thinkingActiveStep}
        completedSteps={thinkingCompleted}
      />
    {:else if currentStep === 'results'}
      <ResultsDashboard
        matches={matchResults}
        brandName={brandContext.brandName}
        on:startOver={handleStartOver}
      />
    {/if}
```

Keep the existing header/nav bar, the "Switch to manual search" link, the sign-out button, and the Campaigns tab. Only replace the content area where `MatchAgentChat` was rendered.

The "Switch to manual search" link at the bottom should remain as a fallback. When clicked it sets `showManualSearch = true` and shows the old search UI. Add a condition: only show it on `intake` and `questions` steps.

- [ ] **Step 3: Clean up unused imports**

Remove the `MatchAgentChat` import since it's replaced by the new components. Keep the component file itself — don't delete it yet in case we need to reference it.

- [ ] **Step 4: Verify it compiles and renders**

Run: `npm run check`
Expected: No TypeScript errors.

Run: `npm run dev`
Navigate to `/brands/portal` in the browser. Expected:
1. See the intake card centered on screen with 4 fields
2. Fill in at least the description, click "Find My Audience"
3. See AI-driven questions with clickable chip answers
4. After ~4-6 questions, see the thinking stepper animate
5. See the results dashboard with summary cards and creator grid

- [ ] **Step 5: Commit**

```bash
git add src/routes/brands/portal/+page.svelte
git commit -m "feat(brands): rewire portal as 4-step guided audience finder flow"
```

---

### Task 8: Polish and Edge Cases

**Files:**
- Modify: `src/lib/components/brands/GuidedQuestions.svelte`
- Modify: `src/lib/components/brands/ResultsDashboard.svelte`

- [ ] **Step 1: Handle the case where AI doesn't return choices**

In `GuidedQuestions.svelte`, when the AI is in Phase 4 (confirmation) or Phase 5 (results delivery), it won't return choices. The component already handles this — `currentChoices` will be null and the text will display without chips. But we need a confirmation button. After the `{#if loading}` / `{:else if currentChoices}` block, add an else case for text-only messages that need a response:

```svelte
        {:else}
          <!-- No chips — show a simple text input for confirmation/freeform -->
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
```

- [ ] **Step 2: Handle empty match results gracefully**

In `ResultsDashboard.svelte`, add an empty state above the creator grid:

```svelte
    {#if matches.length === 0}
      <div class="empty-state">
        <p class="empty-text">No creators matched your criteria. Try adjusting your brief.</p>
        <button class="text-btn" on:click={() => dispatch('startOver')}>Start over</button>
      </div>
    {:else}
      <!-- existing grid-header and creator-grid -->
    {/if}
```

Add the style:

```css
  .empty-state {
    text-align: center;
    padding: 48px 24px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .empty-text {
    font-size: 15px;
    color: var(--text-secondary);
    margin: 0;
  }
```

- [ ] **Step 3: Test the full flow end-to-end in the browser**

Run: `npm run dev`

Test the golden path:
1. Land on portal → see intake card
2. Fill in "Sustainable sneakers" as description → click Find My Audience
3. AI asks first question with chip options → click a chip
4. Continue for 4-6 questions
5. Stepper appears with checkmarks animating
6. Results dashboard loads with summary cards + creator grid
7. Select/deselect creators → sticky bar updates count and cost
8. Click "Start over" → back to intake card

Edge cases:
- Submit intake with only description (other fields blank) — should work
- Click "Type your own answer" and submit custom text — should work
- During confirmation phase (no chips), type "yes" and submit — should work

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/brands/GuidedQuestions.svelte src/lib/components/brands/ResultsDashboard.svelte
git commit -m "feat(brands): add edge case handling for no-chips and empty results"
```
