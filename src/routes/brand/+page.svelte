<script lang="ts">
  import { onMount } from 'svelte';

  // ── Types ──────────────────────────────────────────────────────────────────
  interface TopSignal {
    signal: string;
    score: number;
  }

  interface Cohort {
    cohort_id: string;
    label: string;
    description: string;
    user_count: number;
    avg_match_score: number;
    avg_confidence: number;
    top_signals: TopSignal[];
    centroid_vector?: number[];
    tier?: number;
  }

  interface MatchResult {
    query_id: string;
    total_matched: number;
    cohorts: Cohort[];
    tier_breakdown: Record<number, number>;
    top_users: unknown[];
    signal_coverage: { searched: number; matched: number };
    processing_ms: number;
    correlation_expansions: number;
  }

  interface ProgressStep {
    id: string;
    label: string;
    description: string;
    count?: number;
  }

  interface CorrelationRow {
    signal: string;
    category: string;
    lift: number;
    confidence: number;
    support: number;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let prompt = '';
  let charCount = 0;
  const maxChars = 500;

  let isRunning = false;
  let currentStep = '';
  let stepIndex = 0;
  let result: MatchResult | null = null;
  let errorMsg = '';
  let visible = false;
  let resultsVisible = false;

  // Expanding state
  let expandingCohortId = '';
  let expandResults: Record<string, unknown> = {};

  // Correlation explorer
  let corrSignal = '';
  let corrMinLift = 1.5;
  let corrLoading = false;
  let corrResults: CorrelationRow[] = [];
  let corrError = '';

  const STEPS: ProgressStep[] = [
    { id: 'parsing',   label: 'Parsing query',      description: 'Extracting intent, demographics, and behavioral signals from your description' },
    { id: 'expanding', label: 'Expanding signals',  description: 'Discovering correlated signals in the identity graph to widen the match pool' },
    { id: 'matching',  label: 'Matching users',     description: 'Scanning the full graph for users matching your signal criteria' },
    { id: 'clustering',label: 'Clustering cohorts', description: 'Grouping matched users into behaviorally similar audience segments' },
    { id: 'labeling',  label: 'Labeling cohorts',   description: 'Generating human-readable labels and descriptions for each segment' },
  ];

  // ── Reactive ───────────────────────────────────────────────────────────────
  $: charCount = prompt.length;
  $: activeTiers = result
    ? Object.entries(result.tier_breakdown)
        .filter(([, count]) => count > 0)
        .sort(([a], [b]) => Number(a) - Number(b))
    : [];

  onMount(() => {
    requestAnimationFrame(() => { visible = true; });
  });

  // ── SSE search ─────────────────────────────────────────────────────────────
  async function runSearch() {
    if (!prompt.trim() || isRunning) return;
    isRunning = true;
    result = null;
    errorMsg = '';
    resultsVisible = false;
    stepIndex = 0;
    currentStep = STEPS[0].id;

    try {
      const response = await fetch('/api/brand/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), brand_id: 'demo' }),
      });

      if (!response.ok) {
        errorMsg = `Request failed: ${response.status} ${response.statusText}`;
        isRunning = false;
        return;
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        errorMsg = 'No response stream available.';
        isRunning = false;
        return;
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;

          try {
            const data = JSON.parse(raw);

            if (data.error) {
              errorMsg = data.error;
              isRunning = false;
              return;
            }

            if (data.step) {
              currentStep = data.step;
              const idx = STEPS.findIndex(s => s.id === data.step);
              if (idx >= 0) stepIndex = idx;
            }

            if (data.done && data.result) {
              result = data.result as MatchResult;
              isRunning = false;
              setTimeout(() => { resultsVisible = true; }, 50);
              return;
            }
          } catch {
            // skip malformed line
          }
        }
      }
    } catch (err) {
      errorMsg = err instanceof Error ? err.message : 'Unknown error occurred.';
    } finally {
      isRunning = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) runSearch();
  }

  // ── Expand lookalikes ──────────────────────────────────────────────────────
  async function expandLookalikes(cohortId: string) {
    expandingCohortId = cohortId;
    try {
      const res = await fetch('/api/brand/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cohort_id: cohortId, brand_id: 'demo', multiplier: 3 }),
      });
      if (!res.ok) return;
      expandResults = { ...expandResults, [cohortId]: await res.json() };
    } finally {
      expandingCohortId = '';
    }
  }

  // ── Correlation explorer ───────────────────────────────────────────────────
  async function fetchCorrelations() {
    if (!corrSignal.trim()) return;
    corrLoading = true;
    corrError = '';
    corrResults = [];

    try {
      const params = new URLSearchParams({
        signal: corrSignal.trim(),
        min_lift: corrMinLift.toString(),
      });
      const res = await fetch(`/api/brand/correlations?${params}`);
      if (!res.ok) {
        corrError = `Error ${res.status}`;
        return;
      }
      const data = await res.json();
      corrResults = data.correlations ?? data ?? [];
    } catch (err) {
      corrError = err instanceof Error ? err.message : 'Failed to fetch correlations.';
    } finally {
      corrLoading = false;
    }
  }

  function tierColor(tier: number): string {
    const map: Record<number, string> = {
      1: '#FF4D4D',
      2: '#FF8A4D',
      3: '#FFB84D',
      4: '#4D7CFF',
      5: '#9B7DFF',
    };
    return map[tier] ?? '#888';
  }

  function confidenceColor(pct: number): string {
    if (pct >= 80) return '#4ade80';
    if (pct >= 60) return '#FFB84D';
    return '#FF4D4D';
  }

  function scoreLabel(score: number): string {
    return (score * 100).toFixed(0);
  }
</script>

<div class="page" class:visible>
  <!-- ── Privacy banner ─────────────────────────────────────────────── -->
  <div class="privacy-banner">
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
      <path d="M7 1L2 3.5V7c0 2.8 2.1 5.1 5 5.8C9.9 12.1 12 9.8 12 7V3.5L7 1Z" stroke="#4D7CFF" stroke-width="1.2" fill="none"/>
      <path d="M5 7l1.5 1.5L9 5" stroke="#4D7CFF" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
    <span>Brands see cohort summaries only — no individual user data is shared.</span>
  </div>

  <!-- ── Header ─────────────────────────────────────────────────────── -->
  <header class="page-header">
    <p class="eyebrow-pill">Audience Intelligence</p>
    <h1 class="h1">Find Your Exact Audience</h1>
    <p class="page-sub">
      Describe your ideal customer in plain language. We'll find them in the Wagwan identity graph.
    </p>
  </header>

  <!-- ── Query section ─────────────────────────────────────────────── -->
  <section class="query-section">
    <div class="query-card">
      <div class="query-label-row">
        <label for="audience-prompt" class="query-label">Audience description</label>
        <span class="char-count" class:char-warn={charCount > maxChars * 0.9}>
          {charCount}/{maxChars}
        </span>
      </div>
      <textarea
        id="audience-prompt"
        class="query-textarea"
        rows={6}
        maxlength={maxChars}
        bind:value={prompt}
        on:keydown={handleKeydown}
        placeholder={`Fashion-forward women 22–34 in metro India who shop DTC beauty and follow fitness influencers
Crypto-native founders aged 28–40 who use cold wallets and have funded at least one startup
Gen Z gamers in Southeast Asia who stream on Twitch and buy limited-edition sneakers`}
        disabled={isRunning}
      ></textarea>
      <div class="query-footer">
        <span class="query-hint">
          <kbd>⌘</kbd><kbd>↵</kbd> to submit
        </span>
        <button
          class="btn-search"
          class:btn-search--loading={isRunning}
          on:click={runSearch}
          disabled={isRunning || !prompt.trim()}
        >
          {#if isRunning}
            <span class="spinner" aria-hidden="true"></span>
            <span>Searching…</span>
          {:else}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M10 10l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            </svg>
            <span>Find Audience</span>
          {/if}
        </button>
      </div>
    </div>
  </section>

  <!-- ── Progress display ──────────────────────────────────────────── -->
  {#if isRunning}
    <section class="progress-section">
      <div class="progress-steps">
        {#each STEPS as step, i}
          {@const isActive = step.id === currentStep}
          {@const isDone = i < stepIndex}
          <div class="step-row" class:step-row--active={isActive} class:step-row--done={isDone}>
            <div class="step-icon">
              {#if isDone}
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                  <path d="M2 6l3 3 5-5" stroke="#4ade80" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              {:else if isActive}
                <span class="step-dot step-dot--pulse"></span>
              {:else}
                <span class="step-dot step-dot--idle"></span>
              {/if}
            </div>
            <div class="step-text">
              <span class="step-label">{step.label}</span>
              {#if isActive}
                <span class="step-desc">{step.description}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>

      <div class="progress-bar-track">
        <div
          class="progress-bar-fill"
          style="width: {Math.round(((stepIndex + 1) / STEPS.length) * 100)}%"
        ></div>
      </div>
    </section>
  {/if}

  <!-- ── Error ─────────────────────────────────────────────────────── -->
  {#if errorMsg}
    <div class="error-banner">
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
        <circle cx="7" cy="7" r="6" stroke="#FF4D4D" stroke-width="1.2"/>
        <path d="M7 4v3M7 9.5v.5" stroke="#FF4D4D" stroke-width="1.5" stroke-linecap="round"/>
      </svg>
      <span>{errorMsg}</span>
    </div>
  {/if}

  <!-- ── Results ───────────────────────────────────────────────────── -->
  {#if result}
    <div class="results-wrapper" class:results-visible={resultsVisible}>

      <!-- Summary bar -->
      <section class="summary-bar">
        <div class="summary-stat">
          <span class="summary-num">{result.total_matched.toLocaleString()}</span>
          <span class="summary-label">users matched</span>
        </div>

        <div class="summary-divider"></div>

        <div class="tier-chips">
          {#each activeTiers as [tier, count]}
            <span class="tier-chip" style="--tier-color: {tierColor(Number(tier))}">
              T{tier}: {count.toLocaleString()}
            </span>
          {/each}
        </div>

        <div class="summary-divider"></div>

        <div class="summary-meta-group">
          <span class="summary-meta">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <circle cx="6" cy="6" r="5" stroke="currentColor" stroke-width="1.2"/>
              <path d="M6 3.5v2.5l1.5 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            {result.processing_ms}ms
          </span>
          <span class="summary-meta">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path d="M2 6h8M6 2v8" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
            {result.signal_coverage.matched}/{result.signal_coverage.searched} signals
          </span>
          {#if result.correlation_expansions > 0}
            <span class="summary-meta summary-meta--accent">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path d="M2 10c2-4 6-8 8-8M6 6l4-4-4 0M10 6V2" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
              {result.correlation_expansions} expansions
            </span>
          {/if}
        </div>
      </section>

      <!-- Cohort cards grid -->
      <section class="cohorts-section">
        <h2 class="section-title">Audience Cohorts</h2>
        <div class="cohorts-grid">
          {#each result.cohorts as cohort}
            {@const confPct = Math.round(cohort.avg_confidence * 100)}
            {@const isCorr = (cohort.tier ?? 0) >= 4}
            <div class="cohort-card">
              <div class="cohort-card-top">
                <div class="cohort-label-row">
                  <h3 class="cohort-label">{cohort.label}</h3>
                  {#if isCorr}
                    <span class="via-corr-badge">Via correlations</span>
                  {/if}
                </div>
                <p class="cohort-desc">{cohort.description}</p>
              </div>

              <div class="cohort-card-mid">
                <div class="cohort-count-badge">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <circle cx="6" cy="4" r="2" stroke="currentColor" stroke-width="1.2"/>
                    <path d="M2 10c0-2.2 1.8-4 4-4s4 1.8 4 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
                  </svg>
                  {cohort.user_count.toLocaleString()} users
                </div>

                <div class="conf-bar-wrap">
                  <div class="conf-bar-label">
                    <span>Avg confidence</span>
                    <span style="color: {confidenceColor(confPct)}">{confPct}%</span>
                  </div>
                  <div class="conf-bar-track">
                    <div
                      class="conf-bar-fill"
                      style="width: {confPct}%; background: {confidenceColor(confPct)}"
                    ></div>
                  </div>
                </div>
              </div>

              {#if cohort.top_signals?.length}
                <div class="signal-chips">
                  {#each cohort.top_signals.slice(0, 3) as sig}
                    <span class="signal-chip">
                      <span class="signal-chip-name">{sig.signal}</span>
                      <span class="signal-chip-score">{scoreLabel(sig.score)}</span>
                    </span>
                  {/each}
                </div>
              {/if}

              <div class="cohort-card-footer">
                <button
                  class="btn-expand"
                  class:btn-expand--loading={expandingCohortId === cohort.cohort_id}
                  disabled={expandingCohortId === cohort.cohort_id}
                  on:click={() => expandLookalikes(cohort.cohort_id)}
                >
                  {#if expandingCohortId === cohort.cohort_id}
                    <span class="spinner spinner--sm" aria-hidden="true"></span>
                    Expanding…
                  {:else if expandResults[cohort.cohort_id]}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Expanded
                  {:else}
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                      <path d="M2 6h8M8 3l3 3-3 3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    Expand 3x lookalikes
                  {/if}
                </button>
              </div>
            </div>
          {/each}
        </div>
      </section>

      <!-- Correlation explorer -->
      <section class="corr-section">
        <div class="corr-header">
          <h2 class="section-title">Correlation Explorer</h2>
          <p class="corr-sub">Discover which signals co-occur at high rates in the identity graph.</p>
        </div>

        <div class="corr-controls">
          <div class="corr-input-wrap">
            <label for="corr-signal" class="sr-only">Signal name</label>
            <input
              id="corr-signal"
              class="corr-input"
              type="text"
              placeholder="e.g. fashion_dupe_buyer"
              bind:value={corrSignal}
              on:keydown={(e) => e.key === 'Enter' && fetchCorrelations()}
            />
          </div>

          <div class="corr-slider-wrap">
            <label class="corr-slider-label" for="min-lift">
              Min lift: <strong>{corrMinLift.toFixed(1)}x</strong>
            </label>
            <input
              id="min-lift"
              class="corr-slider"
              type="range"
              min="1.0"
              max="4.0"
              step="0.1"
              bind:value={corrMinLift}
            />
          </div>

          <button
            class="btn-corr"
            on:click={fetchCorrelations}
            disabled={corrLoading || !corrSignal.trim()}
          >
            {#if corrLoading}
              <span class="spinner spinner--sm" aria-hidden="true"></span>
            {:else}
              Explore
            {/if}
          </button>
        </div>

        {#if corrError}
          <p class="corr-error">{corrError}</p>
        {/if}

        {#if corrResults.length > 0}
          <div class="corr-table-wrap">
            <table class="corr-table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Category</th>
                  <th>Lift</th>
                  <th>Confidence</th>
                  <th>Support</th>
                </tr>
              </thead>
              <tbody>
                {#each corrResults as row}
                  <tr>
                    <td class="corr-signal-cell">{row.signal}</td>
                    <td class="corr-cat-cell">{row.category}</td>
                    <td class="corr-num-cell" style="color: {row.lift >= 2 ? '#4ade80' : row.lift >= 1.5 ? '#FFB84D' : 'var(--text-secondary)'}">
                      {row.lift.toFixed(2)}x
                    </td>
                    <td class="corr-num-cell">{(row.confidence * 100).toFixed(0)}%</td>
                    <td class="corr-num-cell">{(row.support * 100).toFixed(1)}%</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      </section>
    </div>
  {/if}
</div>

<style>
  /* ── Page shell ─────────────────────────────────────────────────────────── */
  .page {
    min-height: 100vh;
    background: #0a0a0a;
    padding: 2rem 1.5rem 6rem;
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.6s cubic-bezier(0.32, 0.72, 0, 1), transform 0.6s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .page.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── Privacy banner ─────────────────────────────────────────────────────── */
  .privacy-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 48rem;
    margin: 0 auto 2rem;
    padding: 0.625rem 1rem;
    border-radius: 9999px;
    background: rgba(77, 124, 255, 0.06);
    border: 1px solid rgba(77, 124, 255, 0.18);
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.55);
  }

  /* ── Header ─────────────────────────────────────────────────────────────── */
  .page-header {
    text-align: center;
    max-width: 48rem;
    margin: 0 auto 2.5rem;
  }

  .eyebrow-pill {
    display: inline-block;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: rgba(255, 255, 255, 0.4);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    padding: 0.375rem 1rem;
    margin-bottom: 1.25rem;
  }

  .h1 {
    font-size: clamp(2rem, 5vw, 3.25rem);
    font-weight: 600;
    line-height: 1.08;
    letter-spacing: -0.03em;
    color: #fff;
    margin: 0 0 1rem;
  }

  .page-sub {
    font-size: 1rem;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.45);
    margin: 0;
  }

  /* ── Query card ─────────────────────────────────────────────────────────── */
  .query-section {
    max-width: 48rem;
    margin: 0 auto 2rem;
  }

  .query-card {
    border-radius: 1.25rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    padding: 1.5rem;
    transition: border-color 0.3s ease;
  }
  .query-card:focus-within {
    border-color: rgba(77, 124, 255, 0.3);
  }

  .query-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.75rem;
  }

  .query-label {
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(255, 255, 255, 0.35);
  }

  .char-count {
    font-size: 0.6875rem;
    font-family: ui-monospace, 'SF Mono', monospace;
    color: rgba(255, 255, 255, 0.25);
    transition: color 0.2s;
  }
  .char-count.char-warn {
    color: #FFB84D;
  }

  .query-textarea {
    width: 100%;
    background: transparent;
    border: none;
    outline: none;
    resize: none;
    font-size: 0.9375rem;
    line-height: 1.65;
    color: rgba(255, 255, 255, 0.88);
    font-family: inherit;
    box-sizing: border-box;
    caret-color: #FF4D4D;
  }

  .query-textarea::placeholder {
    color: rgba(255, 255, 255, 0.2);
    white-space: pre-line;
  }

  .query-textarea:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .query-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .query-hint {
    font-size: 0.6875rem;
    color: rgba(255, 255, 255, 0.2);
    display: flex;
    gap: 0.25rem;
    align-items: center;
  }

  kbd {
    display: inline-block;
    font-size: 0.625rem;
    font-family: ui-monospace, 'SF Mono', monospace;
    padding: 0.125rem 0.375rem;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.3);
  }

  /* ── Search button ──────────────────────────────────────────────────────── */
  .btn-search {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #fff;
    background: #FF4D4D;
    border: none;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);
    box-shadow: 0 0 20px rgba(255, 77, 77, 0.25);
  }
  .btn-search:hover:not(:disabled) {
    transform: translateY(-1px);
    box-shadow: 0 0 32px rgba(255, 77, 77, 0.35);
  }
  .btn-search:active:not(:disabled) {
    transform: scale(0.97);
  }
  .btn-search:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .btn-search--loading {
    background: rgba(255, 77, 77, 0.6);
  }

  /* ── Progress ───────────────────────────────────────────────────────────── */
  .progress-section {
    max-width: 48rem;
    margin: 0 auto 2rem;
    border-radius: 1.25rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    padding: 1.5rem;
  }

  .progress-steps {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1.25rem;
  }

  .step-row {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    opacity: 0.35;
    transition: opacity 0.3s;
  }
  .step-row--active {
    opacity: 1;
  }
  .step-row--done {
    opacity: 0.6;
  }

  .step-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-top: 1px;
  }

  .step-dot {
    display: block;
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .step-dot--idle {
    background: rgba(255, 255, 255, 0.15);
  }
  .step-dot--pulse {
    background: #FF4D4D;
    box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.5);
    animation: pulse-ring 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }

  @keyframes pulse-ring {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 77, 77, 0.5); }
    50% { box-shadow: 0 0 0 5px rgba(255, 77, 77, 0); }
  }

  .step-text {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
  }

  .step-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
  }

  .step-desc {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.45);
    line-height: 1.4;
  }

  .progress-bar-track {
    height: 3px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%;
    border-radius: 9999px;
    background: linear-gradient(90deg, #FF4D4D, #4D7CFF);
    transition: width 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  }

  /* ── Error ──────────────────────────────────────────────────────────────── */
  .error-banner {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    max-width: 48rem;
    margin: 0 auto 2rem;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    background: rgba(255, 77, 77, 0.08);
    border: 1px solid rgba(255, 77, 77, 0.2);
    font-size: 0.8125rem;
    color: rgba(255, 77, 77, 0.9);
  }

  /* ── Results wrapper ────────────────────────────────────────────────────── */
  .results-wrapper {
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.5s cubic-bezier(0.32, 0.72, 0, 1), transform 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .results-wrapper.results-visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── Summary bar ────────────────────────────────────────────────────────── */
  .summary-bar {
    max-width: 56rem;
    margin: 0 auto 2rem;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 1rem 1.5rem;
    padding: 1.25rem 1.5rem;
    border-radius: 1rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .summary-stat {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .summary-num {
    font-size: 1.5rem;
    font-weight: 700;
    font-family: ui-monospace, 'SF Mono', monospace;
    letter-spacing: -0.03em;
    color: #fff;
    line-height: 1;
  }

  .summary-label {
    font-size: 0.6875rem;
    color: rgba(255, 255, 255, 0.35);
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .summary-divider {
    width: 1px;
    height: 2rem;
    background: rgba(255, 255, 255, 0.08);
    flex-shrink: 0;
  }

  .tier-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .tier-chip {
    font-size: 0.6875rem;
    font-weight: 700;
    font-family: ui-monospace, 'SF Mono', monospace;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    border: 1px solid color-mix(in srgb, var(--tier-color) 30%, transparent);
    background: color-mix(in srgb, var(--tier-color) 10%, transparent);
    color: var(--tier-color);
  }

  .summary-meta-group {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .summary-meta {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    font-size: 0.75rem;
    font-family: ui-monospace, 'SF Mono', monospace;
    color: rgba(255, 255, 255, 0.4);
  }

  .summary-meta--accent {
    color: #FFB84D;
  }

  /* ── Section title ──────────────────────────────────────────────────────── */
  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.9);
    margin: 0 0 1.25rem;
    letter-spacing: -0.01em;
  }

  /* ── Cohort cards ───────────────────────────────────────────────────────── */
  .cohorts-section {
    max-width: 56rem;
    margin: 0 auto 3rem;
  }

  .cohorts-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .cohorts-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .cohort-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.5rem;
    border-radius: 1.25rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    transition: border-color 0.4s cubic-bezier(0.32, 0.72, 0, 1), transform 0.4s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.4s ease;
  }
  .cohort-card:hover {
    border-color: rgba(77, 124, 255, 0.25);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(77, 124, 255, 0.08);
  }

  .cohort-card-top {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .cohort-label-row {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    flex-wrap: wrap;
  }

  .cohort-label {
    font-size: 1rem;
    font-weight: 700;
    color: #fff;
    margin: 0;
    line-height: 1.3;
  }

  .via-corr-badge {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
    background: rgba(255, 184, 77, 0.12);
    border: 1px solid rgba(255, 184, 77, 0.25);
    color: #FFB84D;
    flex-shrink: 0;
  }

  .cohort-desc {
    font-size: 0.8125rem;
    line-height: 1.55;
    color: rgba(255, 255, 255, 0.45);
    margin: 0;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .cohort-card-mid {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .cohort-count-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    font-weight: 600;
    font-family: ui-monospace, 'SF Mono', monospace;
    color: rgba(255, 255, 255, 0.7);
    background: rgba(255, 255, 255, 0.06);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.3rem 0.75rem;
    border-radius: 9999px;
    width: fit-content;
  }

  .conf-bar-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .conf-bar-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.6875rem;
    color: rgba(255, 255, 255, 0.35);
  }

  .conf-bar-track {
    height: 4px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.08);
    overflow: hidden;
  }

  .conf-bar-fill {
    height: 100%;
    border-radius: 9999px;
    transition: width 0.6s cubic-bezier(0.32, 0.72, 0, 1);
  }

  /* ── Signal chips ───────────────────────────────────────────────────────── */
  .signal-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .signal-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.6875rem;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: rgba(255, 255, 255, 0.04);
  }

  .signal-chip-name {
    color: rgba(255, 255, 255, 0.65);
    font-weight: 500;
  }

  .signal-chip-score {
    color: #4D7CFF;
    font-weight: 700;
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 0.625rem;
  }

  /* ── Expand button ──────────────────────────────────────────────────────── */
  .cohort-card-footer {
    margin-top: auto;
  }

  .btn-expand {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: rgba(77, 124, 255, 0.9);
    background: rgba(77, 124, 255, 0.08);
    border: 1px solid rgba(77, 124, 255, 0.2);
    padding: 0.45rem 0.875rem;
    border-radius: 9999px;
    cursor: pointer;
    transition: all 0.25s ease;
  }
  .btn-expand:hover:not(:disabled) {
    background: rgba(77, 124, 255, 0.14);
    border-color: rgba(77, 124, 255, 0.35);
  }
  .btn-expand:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  /* ── Correlation explorer ───────────────────────────────────────────────── */
  .corr-section {
    max-width: 56rem;
    margin: 0 auto;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  .corr-header {
    margin-bottom: 1.5rem;
  }

  .corr-sub {
    font-size: 0.8125rem;
    color: rgba(255, 255, 255, 0.35);
    margin: 0.25rem 0 0;
  }

  .corr-controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: flex-end;
    margin-bottom: 1.5rem;
  }

  .corr-input-wrap {
    flex: 1;
    min-width: 200px;
  }

  .corr-input {
    width: 100%;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.625rem;
    padding: 0.625rem 0.875rem;
    font-size: 0.875rem;
    color: rgba(255, 255, 255, 0.88);
    font-family: inherit;
    outline: none;
    box-sizing: border-box;
    transition: border-color 0.2s;
  }
  .corr-input:focus {
    border-color: rgba(77, 124, 255, 0.4);
  }
  .corr-input::placeholder {
    color: rgba(255, 255, 255, 0.2);
  }

  .corr-slider-wrap {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 160px;
  }

  .corr-slider-label {
    font-size: 0.6875rem;
    color: rgba(255, 255, 255, 0.4);
  }

  .corr-slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 4px;
    border-radius: 9999px;
    background: rgba(255, 255, 255, 0.1);
    outline: none;
    cursor: pointer;
  }
  .corr-slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #4D7CFF;
    cursor: pointer;
    box-shadow: 0 0 8px rgba(77, 124, 255, 0.4);
  }

  .btn-corr {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    padding: 0.625rem 1.25rem;
    border-radius: 0.625rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: #fff;
    background: rgba(77, 124, 255, 0.25);
    border: 1px solid rgba(77, 124, 255, 0.35);
    cursor: pointer;
    transition: all 0.25s ease;
    white-space: nowrap;
  }
  .btn-corr:hover:not(:disabled) {
    background: rgba(77, 124, 255, 0.35);
  }
  .btn-corr:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .corr-error {
    font-size: 0.8125rem;
    color: #FF4D4D;
    margin: 0 0 1rem;
  }

  .corr-table-wrap {
    overflow-x: auto;
    border-radius: 0.875rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .corr-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  .corr-table thead tr {
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .corr-table th {
    padding: 0.75rem 1rem;
    text-align: left;
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(255, 255, 255, 0.3);
    background: rgba(255, 255, 255, 0.02);
  }

  .corr-table td {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    color: rgba(255, 255, 255, 0.7);
  }

  .corr-table tr:last-child td {
    border-bottom: none;
  }

  .corr-table tbody tr:hover td {
    background: rgba(255, 255, 255, 0.02);
  }

  .corr-signal-cell {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.85);
  }

  .corr-cat-cell {
    color: rgba(255, 255, 255, 0.45);
    font-size: 0.75rem;
  }

  .corr-num-cell {
    font-family: ui-monospace, 'SF Mono', monospace;
    font-size: 0.75rem;
    font-weight: 600;
    text-align: right;
  }

  /* ── Spinner ────────────────────────────────────────────────────────────── */
  .spinner {
    display: inline-block;
    width: 14px;
    height: 14px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }
  .spinner--sm {
    width: 10px;
    height: 10px;
    border-width: 1.5px;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ── Accessibility ──────────────────────────────────────────────────────── */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  /* ── Mobile ─────────────────────────────────────────────────────────────── */
  @media (max-width: 640px) {
    .page {
      padding: 1.5rem 1rem 4rem;
    }

    .summary-bar {
      gap: 0.75rem 1rem;
    }

    .summary-divider {
      display: none;
    }

    .corr-controls {
      flex-direction: column;
    }

    .corr-input-wrap,
    .corr-slider-wrap {
      min-width: unset;
      width: 100%;
    }

    .btn-corr {
      width: 100%;
      justify-content: center;
    }
  }
</style>
