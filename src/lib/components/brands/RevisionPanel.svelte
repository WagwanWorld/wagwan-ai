<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let currentImageUrl: string = '';
  export let previousImageUrl: string = '';
  export let currentVersion: number = 1;
  export let maxRevisions: number = 2;
  export let revisionCount: number = 0;

  const dispatch = createEventDispatcher<{
    submitRevision: { feedback: string; toggles: Record<string, string> };
    cancel: void;
  }>();

  let feedback = '';
  let submitting = false;

  // Toggle groups
  let layoutToggle = '';
  let moodToggle = '';
  let textSizeToggle = '';
  let densityToggle = '';

  const toggleGroups = [
    {
      label: 'LAYOUT',
      key: 'layout',
      options: ['Centered', 'Left-aligned', 'Asymmetric'],
      bind: () => layoutToggle,
      set: (v: string) => { layoutToggle = layoutToggle === v ? '' : v; },
    },
    {
      label: 'MOOD',
      key: 'mood',
      options: ['Warmer', 'Cooler', 'Bolder', 'Softer'],
      bind: () => moodToggle,
      set: (v: string) => { moodToggle = moodToggle === v ? '' : v; },
    },
    {
      label: 'TEXT SIZE',
      key: 'textSize',
      options: ['Larger', 'Smaller'],
      bind: () => textSizeToggle,
      set: (v: string) => { textSizeToggle = textSizeToggle === v ? '' : v; },
    },
    {
      label: 'DENSITY',
      key: 'density',
      options: ['More whitespace', 'More content'],
      bind: () => densityToggle,
      set: (v: string) => { densityToggle = densityToggle === v ? '' : v; },
    },
  ];

  function getActiveToggles(): Record<string, string> {
    const map: Record<string, string> = {
      layout: layoutToggle,
      mood: moodToggle,
      textSize: textSizeToggle,
      density: densityToggle,
    };
    return Object.fromEntries(Object.entries(map).filter(([, v]) => v !== ''));
  }

  $: activeToggles = getActiveToggles();
  $: {
    // trigger reactive recalc when toggles change
    layoutToggle; moodToggle; textSizeToggle; densityToggle;
    activeToggles = getActiveToggles();
  }

  $: canSubmit = feedback.trim().length > 0 || Object.keys(activeToggles).length > 0;
  $: revisionsLeft = maxRevisions - revisionCount;

  async function handleSubmit() {
    if (!canSubmit || submitting) return;
    submitting = true;
    dispatch('submitRevision', { feedback: feedback.trim(), toggles: getActiveToggles() });
    submitting = false;
  }
</script>

<div class="rp">
  <div class="rp-header">
    <span class="rp-label">REVISION PANEL</span>
    <span class="rp-counter">{revisionsLeft} revision{revisionsLeft !== 1 ? 's' : ''} remaining</span>
    <div class="rp-spacer"></div>
    <button class="rp-cancel" on:click={() => dispatch('cancel')}>Cancel</button>
  </div>

  <!-- Side by side image comparison -->
  <div class="rp-compare">
    <div class="rp-compare-col">
      <span class="rp-compare-label">CURRENT — V{currentVersion}</span>
      <div class="rp-image-wrap">
        {#if currentImageUrl}
          <img class="rp-image" src={currentImageUrl} alt="Current V{currentVersion}" />
        {:else}
          <div class="rp-image-empty">No image</div>
        {/if}
      </div>
    </div>

    {#if previousImageUrl && previousImageUrl !== currentImageUrl}
      <div class="rp-compare-col rp-compare-col--prev">
        <span class="rp-compare-label">PREVIOUS — V{currentVersion - 1}</span>
        <div class="rp-image-wrap rp-image-wrap--dim">
          <img class="rp-image" src={previousImageUrl} alt="Previous V{currentVersion - 1}" />
        </div>
      </div>
    {/if}
  </div>

  <!-- Feedback textarea -->
  <div class="rp-section">
    <span class="rp-label">FEEDBACK</span>
    <textarea
      class="rp-textarea"
      bind:value={feedback}
      placeholder="Describe what to change — e.g. 'Make the background darker, move the headline to the top, use a landscape image instead'"
      rows="4"
    ></textarea>
  </div>

  <!-- Toggles -->
  <div class="rp-section">
    <span class="rp-label">QUICK ADJUSTMENTS</span>
    <div class="rp-toggles">
      {#each toggleGroups as group}
        <div class="rp-toggle-group">
          <span class="rp-toggle-group-label">{group.label}</span>
          <div class="rp-toggle-pills">
            {#each group.options as option}
              <button
                class="rp-pill"
                class:rp-pill--active={group.bind() === option}
                on:click={() => group.set(option)}
              >
                {option}
              </button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Active toggles summary -->
  {#if Object.keys(activeToggles).length > 0}
    <div class="rp-active-summary">
      <span class="rp-label">APPLYING</span>
      <div class="rp-active-pills">
        {#each Object.entries(activeToggles) as [key, value]}
          <span class="rp-active-pill">{key}: {value}</span>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Submit -->
  <div class="rp-footer">
    {#if revisionsLeft <= 0}
      <div class="rp-limit-warn">Revision limit reached — approve or regenerate</div>
    {:else}
      <button
        class="rp-submit"
        on:click={handleSubmit}
        disabled={!canSubmit || submitting}
      >
        {#if submitting}
          Revising...
        {:else}
          Apply Revision
        {/if}
      </button>
    {/if}
  </div>
</div>

<style>
  .rp {
    display: flex;
    flex-direction: column;
    gap: 14px;
    width: 100%;
  }

  .rp-header {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .rp-spacer { flex: 1; }

  .rp-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
  }

  .rp-counter {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    color: #e8464a;
    padding: 3px 8px;
    border-radius: 5px;
    background: rgba(232, 70, 74, 0.08);
    border: 1px solid rgba(232, 70, 74, 0.15);
  }

  .rp-cancel {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    background: none;
    border: 1px solid rgba(255, 255, 255, 0.08);
    border-radius: 6px;
    color: #4a4a50;
    padding: 4px 10px;
    cursor: pointer;
    transition: all 0.15s;
  }
  .rp-cancel:hover { color: #ededef; border-color: rgba(255, 255, 255, 0.15); }

  /* Side-by-side compare */
  .rp-compare {
    display: flex;
    gap: 10px;
  }
  .rp-compare-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
  }
  .rp-compare-col--prev { opacity: 0.5; }
  .rp-compare-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
  }

  .rp-image-wrap {
    aspect-ratio: 4 / 5;
    border-radius: 10px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.07);
  }
  .rp-image-wrap--dim { filter: brightness(0.7); }
  .rp-image {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .rp-image-empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11px;
    color: #4a4a50;
  }

  /* Sections */
  .rp-section {
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    padding: 14px 16px;
  }

  .rp-textarea {
    width: 100%;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 8px;
    color: #ededef;
    font-size: 13px;
    font-family: 'Inter', sans-serif;
    line-height: 1.55;
    padding: 10px 12px;
    resize: vertical;
    min-height: 80px;
    box-sizing: border-box;
  }
  .rp-textarea:focus { outline: none; border-color: rgba(232, 70, 74, 0.25); }
  .rp-textarea::placeholder { color: #4a4a50; font-style: italic; }

  /* Toggles */
  .rp-toggles {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .rp-toggle-group {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .rp-toggle-group-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4a4a50;
  }
  .rp-toggle-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .rp-pill {
    padding: 5px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 500;
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.07);
    color: #8a8a90;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }
  .rp-pill:hover {
    background: rgba(255, 255, 255, 0.07);
    color: #ededef;
    border-color: rgba(255, 255, 255, 0.12);
  }
  .rp-pill--active {
    background: rgba(232, 70, 74, 0.12);
    border-color: rgba(232, 70, 74, 0.3);
    color: #e8464a;
  }
  .rp-pill--active:hover {
    background: rgba(232, 70, 74, 0.18);
  }

  /* Active summary */
  .rp-active-summary {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 14px;
    border-radius: 10px;
    background: rgba(232, 70, 74, 0.04);
    border: 1px solid rgba(232, 70, 74, 0.1);
  }
  .rp-active-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .rp-active-pill {
    font-size: 11px;
    color: #e8464a;
    padding: 2px 8px;
    border-radius: 4px;
    background: rgba(232, 70, 74, 0.08);
    border: 1px solid rgba(232, 70, 74, 0.15);
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-weight: 600;
    text-transform: capitalize;
  }

  /* Footer */
  .rp-footer { display: flex; justify-content: flex-end; padding-top: 2px; }

  .rp-submit {
    padding: 10px 24px;
    border-radius: 8px;
    background: rgba(232, 70, 74, 0.15);
    border: 1px solid rgba(232, 70, 74, 0.3);
    color: #e8464a;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .rp-submit:hover:not(:disabled) {
    background: rgba(232, 70, 74, 0.22);
    border-color: rgba(232, 70, 74, 0.45);
  }
  .rp-submit:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .rp-limit-warn {
    font-size: 12px;
    color: #f59e0b;
    padding: 8px 12px;
    border-radius: 8px;
    background: rgba(245, 158, 11, 0.06);
    border: 1px solid rgba(245, 158, 11, 0.15);
  }

  @media (max-width: 540px) {
    .rp-compare { flex-direction: column; }
    .rp-compare-col--prev { display: none; }
  }
</style>
