<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import VisualReview from './VisualReview.svelte';
  import RevisionPanel from './RevisionPanel.svelte';

  const dispatch = createEventDispatcher<{ back: void }>();

  // ── State machine ──────────────────────────────────────
  type StudioState = 'input' | 'directing' | 'prompt-edit' | 'rendering' | 'review' | 'revising' | 'approved';
  let state: StudioState = 'input';

  // ── Input state ────────────────────────────────────────
  let copy = '';
  let lockedWording = false;
  let format = '4:5 Static';

  // ── Generation result ──────────────────────────────────
  interface GenerationResult {
    generationId: string;
    version: number;
    concept: string;
    designDirection: string;
    whyThisWorks: string[];
    imageUrl: string;
    caption: string;
    hashtags: string[];
    format: string;
    dimensions: string;
    qcReport: {
      textLegible: boolean;
      logoOk: boolean;
      paletteOk: boolean;
      safeZoneOk: boolean;
      issues: string[];
      passed: boolean;
    };
    cost: { total_usd: number };
  }

  let result: GenerationResult | null = null;
  let previousImageUrl = '';

  // ── Direction result (from Step 1) ─────────────────────
  interface DirectionResult {
    generationId: string;
    concept: string;
    designDirection: string;
    whyThisWorks: string[];
    caption: string;
    hashtags: string[];
    imagePrompt: string;
    direction: Record<string, unknown>;
    cost: { direction_usd: number };
  }
  let directionResult: DirectionResult | null = null;
  let editableImagePrompt = '';

  // ── Revision tracking ──────────────────────────────────
  let revisionCount = 0;
  const MAX_REVISIONS = 2;

  // ── Error state ────────────────────────────────────────
  let errorMsg = '';

  // ── Generating progress animation ─────────────────────
  const progressSteps = [
    'Claude is directing...',
    'Generating visual...',
    'Running quality check...',
  ];
  let progressIndex = 0;
  let progressTimer: ReturnType<typeof setInterval> | null = null;

  function startProgressAnimation() {
    progressIndex = 0;
    progressTimer = setInterval(() => {
      if (progressIndex < progressSteps.length - 1) {
        progressIndex++;
      }
    }, 4500);
  }

  function stopProgressAnimation() {
    if (progressTimer) {
      clearInterval(progressTimer);
      progressTimer = null;
    }
  }

  // ── API calls ──────────────────────────────────────────

  // Step 1: Get Claude's creative direction + curated image prompt
  async function handleGenerate() {
    if (!copy.trim()) return;
    errorMsg = '';
    state = 'directing';
    startProgressAnimation();

    try {
      const res = await fetch('/api/brand/creative-studio/direct', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          copy: copy.trim(),
          lockedPhrases: lockedWording ? [copy.trim()] : [],
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Direction failed (${res.status})`);

      directionResult = data as DirectionResult;
      editableImagePrompt = data.imagePrompt;
      state = 'prompt-edit';
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Direction failed — please try again';
      state = 'input';
    } finally {
      stopProgressAnimation();
    }
  }

  // Step 2: Send the (possibly edited) prompt to Gemini for rendering
  async function handleRender() {
    if (!directionResult || !editableImagePrompt.trim()) return;
    errorMsg = '';
    state = 'rendering';
    progressIndex = 1; // skip to "Generating visual..."
    startProgressAnimation();

    try {
      const res = await fetch('/api/brand/creative-studio/render', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationId: directionResult.generationId,
          imagePrompt: editableImagePrompt.trim(),
          direction: directionResult.direction,
          version: 1,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Render failed (${res.status})`);

      result = {
        generationId: directionResult.generationId,
        version: data.version || 1,
        concept: directionResult.concept,
        designDirection: directionResult.designDirection,
        whyThisWorks: directionResult.whyThisWorks,
        imageUrl: data.imageUrl,
        caption: directionResult.caption,
        hashtags: directionResult.hashtags,
        format: 'static_4x5',
        dimensions: '1080x1350',
        qcReport: data.qcReport,
        cost: { total_usd: (directionResult.cost.direction_usd || 0) + (data.cost?.render_usd || 0) },
      };
      state = 'review';
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Render failed';
      state = 'prompt-edit';
    } finally {
      stopProgressAnimation();
    }
  }

  // Re-render with same direction but edited prompt
  async function handleRegenerate() {
    if (!directionResult) return;
    state = 'prompt-edit'; // go back to prompt editing
  }

  async function handleSubmitRevision(e: CustomEvent<{ feedback: string; toggles: Record<string, string> }>) {
    if (!result) return;
    errorMsg = '';
    state = 'generating';
    startProgressAnimation();

    try {
      const res = await fetch('/api/brand/creative-studio/revise', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationId: result.generationId,
          fromVersion: result.version,
          feedback: e.detail.feedback,
          toggles: e.detail.toggles,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || `Revision failed (${res.status})`);

      previousImageUrl = result.imageUrl;
      result = data as GenerationResult;
      revisionCount++;
      state = 'review';
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Revision failed';
      state = 'revising';
    } finally {
      stopProgressAnimation();
    }
  }

  async function handleApprove() {
    if (!result) return;
    errorMsg = '';
    try {
      const res = await fetch('/api/brand/creative-studio/approve', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          generationId: result.generationId,
          version: result.version,
          sendToScheduler: true,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || `Approval failed (${res.status})`);
      }

      state = 'approved';
    } catch (e) {
      errorMsg = e instanceof Error ? e.message : 'Approval failed';
    }
  }

  function resetStudio() {
    state = 'input';
    copy = '';
    lockedWording = false;
    result = null;
    previousImageUrl = '';
    revisionCount = 0;
    errorMsg = '';
    stopProgressAnimation();
  }
</script>

<div class="cs">
  <!-- ══ INPUT ══════════════════════════════════════════ -->
  {#if state === 'input'}
    <div class="cs-section">
      <div class="cs-header">
        <button class="cs-back" on:click={() => dispatch('back')}>← Back</button>
        <div>
          <h2 class="cs-title">AI Creative Studio</h2>
          <p class="cs-subtitle">Paste your copy — Claude directs the visual, AI generates it</p>
        </div>
      </div>

      {#if errorMsg}
        <div class="cs-error">{errorMsg}</div>
      {/if}

      <div class="cs-card">
        <span class="cs-label">YOUR COPY</span>
        <textarea
          class="cs-textarea"
          bind:value={copy}
          placeholder="Paste your copy here — on-image text, headline, CTA..."
          rows="6"
        ></textarea>
        <div class="cs-copy-hint">
          <label class="cs-lock-label">
            <input type="checkbox" bind:checked={lockedWording} />
            <span>Lock exact wording — composited verbatim, not AI-rewritten</span>
          </label>
        </div>
      </div>

      <div class="cs-card cs-card--row">
        <div class="cs-field">
          <span class="cs-label">FORMAT</span>
          <div class="cs-format-selector">
            <div class="cs-format-option cs-format-option--active">
              <span class="cs-format-label">4:5 Static</span>
              <span class="cs-format-dim">1080 × 1350</span>
            </div>
            <div class="cs-format-option cs-format-option--disabled">
              <span class="cs-format-label">Carousel</span>
              <span class="cs-format-soon">Soon</span>
            </div>
            <div class="cs-format-option cs-format-option--disabled">
              <span class="cs-format-label">9:16 Story</span>
              <span class="cs-format-soon">Soon</span>
            </div>
          </div>
        </div>
      </div>

      <div class="cs-actions">
        <button
          class="cs-btn cs-btn--primary"
          on:click={handleGenerate}
          disabled={!copy.trim()}
        >
          ✦ Generate Creative
        </button>
      </div>
    </div>

  <!-- ══ DIRECTING (Claude working) ══════════════════════ -->
  {:else if state === 'directing'}
    <div class="cs-card cs-generating">
      <div class="cs-gen-icon">✦</div>
      <div class="cs-gen-step">Claude is analyzing your brand and crafting the creative direction<span class="cs-dots"></span></div>
    </div>

  <!-- ══ PROMPT EDIT (user reviews/edits the image prompt) ══ -->
  {:else if state === 'prompt-edit' && directionResult}
    <div class="cs-section">
      <div class="cs-header">
        <button class="cs-back" on:click={() => { state = 'input'; }}>← Back</button>
        <div>
          <h2 class="cs-title">Creative Direction</h2>
          <p class="cs-subtitle">Claude crafted a visual brief — review and edit the image prompt before rendering</p>
        </div>
      </div>

      {#if errorMsg}
        <div class="cs-error">{errorMsg}</div>
      {/if}

      <!-- Direction summary -->
      <div class="cs-card">
        <span class="cs-label">CONCEPT</span>
        <p class="cs-concept-text">{directionResult.concept}</p>
      </div>

      {#if directionResult.whyThisWorks?.length}
        <div class="cs-card">
          <span class="cs-label">WHY THIS WORKS</span>
          <ul class="cs-why-list">
            {#each directionResult.whyThisWorks as bullet}
              <li>{bullet}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <!-- THE EDITABLE IMAGE PROMPT -->
      <div class="cs-card cs-prompt-card">
        <div class="cs-prompt-header">
          <span class="cs-label">IMAGE PROMPT</span>
          <span class="cs-prompt-hint">Edit this to change what the AI generates — describe the scene, colors, mood</span>
        </div>
        <textarea
          class="cs-textarea cs-prompt-textarea"
          bind:value={editableImagePrompt}
          rows="5"
        ></textarea>
      </div>

      <div class="cs-actions">
        <button class="cs-btn cs-btn--ghost" on:click={() => { editableImagePrompt = directionResult?.imagePrompt || ''; }}>
          Reset Prompt
        </button>
        <button
          class="cs-btn cs-btn--primary"
          on:click={handleRender}
          disabled={!editableImagePrompt.trim()}
        >
          ✦ Generate Image
        </button>
      </div>
    </div>

  <!-- ══ RENDERING (Gemini working) ════════════════════ -->
  {:else if state === 'rendering'}
    <div class="cs-card cs-generating">
      <div class="cs-gen-icon">✦</div>
      <div class="cs-gen-step">Generating visual<span class="cs-dots"></span></div>
      <div class="cs-gen-steps">
        <div class="cs-gen-step-item cs-gen-step-item--done"><span class="cs-gen-step-num">1</span><span>Creative direction</span></div>
        <div class="cs-gen-step-item cs-gen-step-item--active"><span class="cs-gen-step-num">2</span><span>Generating image...</span></div>
        <div class="cs-gen-step-item"><span class="cs-gen-step-num">3</span><span>Brand overlay + QC</span></div>
      </div>
    </div>

  <!-- ══ REVIEW ═════════════════════════════════════════ -->
  {:else if state === 'review' && result}
    {#if errorMsg}
      <div class="cs-error">{errorMsg}</div>
    {/if}
    <VisualReview
      imageUrl={result.imageUrl}
      concept={result.concept}
      designDirection={result.designDirection}
      whyThisWorks={result.whyThisWorks}
      caption={result.caption}
      hashtags={result.hashtags}
      qcReport={result.qcReport}
      version={result.version}
      format={result.format}
      cost={result.cost}
      on:approve={handleApprove}
      on:revise={() => (state = 'revising')}
      on:regenerate={handleRegenerate}
    />

  <!-- ══ REVISING ═══════════════════════════════════════ -->
  {:else if state === 'revising' && result}
    {#if errorMsg}
      <div class="cs-error">{errorMsg}</div>
    {/if}
    <RevisionPanel
      currentImageUrl={result.imageUrl}
      previousImageUrl={previousImageUrl}
      currentVersion={result.version}
      maxRevisions={MAX_REVISIONS}
      revisionCount={revisionCount}
      on:submitRevision={handleSubmitRevision}
      on:cancel={() => (state = 'review')}
    />

  <!-- ══ APPROVED ═══════════════════════════════════════ -->
  {:else if state === 'approved'}
    <div class="cs-card cs-approved">
      <div class="cs-approved-icon">✓</div>
      <h3 class="cs-approved-title">Creative approved and sent to scheduler</h3>
      <p class="cs-approved-sub">
        Your creative has been added as a draft in the content scheduler. Open the scheduler to set a time and publish.
      </p>
      <div class="cs-approved-actions">
        <button class="cs-btn cs-btn--primary" on:click={resetStudio}>
          Back to Studio
        </button>
        <button class="cs-btn cs-btn--ghost" on:click={() => dispatch('back')}>
          Back to Automation
        </button>
      </div>
    </div>
  {/if}
</div>

<style>
  .cs {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
  }

  /* Section wrapper */
  .cs-section {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  /* Header */
  .cs-header {
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }
  .cs-back {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #4a4a50;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 6px;
    padding: 5px 10px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    flex-shrink: 0;
    margin-top: 3px;
  }
  .cs-back:hover { color: #ededef; border-color: rgba(255, 255, 255, 0.15); }

  .cs-title {
    font-size: 18px;
    font-weight: 700;
    color: #ededef;
    margin: 0 0 2px;
  }
  .cs-subtitle { font-size: 12px; color: #4a4a50; margin: 0; }

  /* Error */
  .cs-error {
    padding: 10px 14px;
    border-radius: 9px;
    background: rgba(239, 68, 68, 0.06);
    border: 1px solid rgba(239, 68, 68, 0.15);
    font-size: 12px;
    color: #f87171;
  }

  /* Glass card */
  .cs-card {
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 14px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cs-card--row { flex-direction: row; align-items: flex-start; flex-wrap: wrap; gap: 16px; }

  .cs-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
  }

  /* Textarea */
  .cs-textarea {
    width: 100%;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    color: #ededef;
    font-size: 14px;
    font-family: 'Inter', sans-serif;
    line-height: 1.6;
    padding: 12px 14px;
    resize: vertical;
    min-height: 120px;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .cs-textarea:focus {
    outline: none;
    border-color: rgba(232, 70, 74, 0.3);
  }
  .cs-textarea::placeholder { color: #4a4a50; font-style: italic; font-size: 13px; }

  .cs-copy-hint { margin-top: 2px; }
  .cs-lock-label {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: #4a4a50;
    cursor: pointer;
    transition: color 0.15s;
  }
  .cs-lock-label:hover { color: #8a8a90; }
  .cs-lock-label input { accent-color: #e8464a; cursor: pointer; }

  /* Format selector */
  .cs-field { flex: 1; min-width: 200px; }
  .cs-format-selector {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    margin-top: 6px;
  }
  .cs-format-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 16px;
    border-radius: 9px;
    border: 1.5px solid rgba(255, 255, 255, 0.07);
    background: rgba(255, 255, 255, 0.02);
    cursor: pointer;
    transition: all 0.15s;
    min-width: 80px;
  }
  .cs-format-option--active {
    border-color: rgba(232, 70, 74, 0.35);
    background: rgba(232, 70, 74, 0.06);
  }
  .cs-format-option--disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .cs-format-label {
    font-size: 12px;
    font-weight: 600;
    color: #ededef;
  }
  .cs-format-dim {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    color: #4a4a50;
    letter-spacing: 0.05em;
  }
  .cs-format-soon {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    color: #4a4a50;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  /* Actions */
  .cs-actions { display: flex; justify-content: flex-end; gap: 8px; }

  .cs-btn {
    padding: 10px 22px;
    border-radius: 9px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
    font-family: inherit;
  }
  .cs-btn--primary {
    background: rgba(232, 70, 74, 0.15);
    border: 1px solid rgba(232, 70, 74, 0.3);
    color: #e8464a;
  }
  .cs-btn--primary:hover:not(:disabled) {
    background: rgba(232, 70, 74, 0.22);
    border-color: rgba(232, 70, 74, 0.45);
  }
  .cs-btn--primary:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }
  .cs-btn--ghost {
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: #8a8a90;
  }
  .cs-btn--ghost:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #ededef;
    border-color: rgba(255, 255, 255, 0.12);
  }

  /* Concept + prompt edit */
  .cs-concept-text {
    font-size: 14px;
    color: #9a9aa0;
    line-height: 1.6;
    margin: 0;
  }
  .cs-why-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cs-why-list li {
    font-size: 12px;
    color: #8a8a90;
    padding-left: 12px;
    position: relative;
    line-height: 1.5;
  }
  .cs-why-list li::before {
    content: '—';
    position: absolute;
    left: 0;
    color: #4a4a50;
  }

  .cs-prompt-card {
    border-color: rgba(232, 70, 74, 0.15);
    background: rgba(232, 70, 74, 0.02);
  }
  .cs-prompt-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .cs-prompt-hint {
    font-size: 11px;
    color: #4a4a50;
    font-style: italic;
  }
  .cs-prompt-textarea {
    min-height: 100px;
    font-size: 13px;
    line-height: 1.7;
    color: #ededef;
  }

  /* Generating state */
  .cs-generating {
    align-items: center;
    text-align: center;
    padding: 40px 24px;
    gap: 16px;
  }
  .cs-gen-icon {
    font-size: 28px;
    color: #e8464a;
    animation: pulse 2s ease-in-out infinite;
  }
  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.9); }
  }

  .cs-gen-step {
    font-size: 14px;
    font-weight: 600;
    color: #ededef;
    min-height: 22px;
  }
  .cs-dots::after {
    content: '...';
    animation: dots 1.4s steps(4, end) infinite;
  }
  @keyframes dots {
    0%, 20% { content: ''; }
    40% { content: '.'; }
    60% { content: '..'; }
    80%, 100% { content: '...'; }
  }

  .cs-gen-steps {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    max-width: 280px;
    margin-top: 8px;
  }
  .cs-gen-step-item {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 12px;
    color: #4a4a50;
    padding: 7px 12px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.04);
    text-align: left;
    transition: all 0.3s;
  }
  .cs-gen-step-item--active {
    color: #ededef;
    background: rgba(232, 70, 74, 0.06);
    border-color: rgba(232, 70, 74, 0.15);
  }
  .cs-gen-step-item--done {
    color: #7fc8a9;
    background: rgba(127, 200, 169, 0.04);
    border-color: rgba(127, 200, 169, 0.1);
  }
  .cs-gen-step-num {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 700;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: rgba(255, 255, 255, 0.05);
    color: #4a4a50;
  }
  .cs-gen-step-item--active .cs-gen-step-num { background: rgba(232, 70, 74, 0.15); color: #e8464a; }
  .cs-gen-step-item--done .cs-gen-step-num { background: rgba(127, 200, 169, 0.1); color: #7fc8a9; }

  /* Approved state */
  .cs-approved {
    align-items: center;
    text-align: center;
    padding: 40px 24px;
    gap: 14px;
  }
  .cs-approved-icon {
    width: 52px;
    height: 52px;
    border-radius: 50%;
    background: rgba(127, 200, 169, 0.12);
    border: 1.5px solid rgba(127, 200, 169, 0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 22px;
    color: #7fc8a9;
  }
  .cs-approved-title {
    font-size: 16px;
    font-weight: 700;
    color: #ededef;
    margin: 0;
  }
  .cs-approved-sub {
    font-size: 13px;
    color: #8a8a90;
    margin: 0;
    max-width: 340px;
    line-height: 1.55;
  }
  .cs-approved-actions {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
    justify-content: center;
    margin-top: 8px;
  }
</style>
