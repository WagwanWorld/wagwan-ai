<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let previousImageUrl: string = '';
  export let previousVersion: number = 1;
  export let maxRevisions: number = 2;

  const dispatch = createEventDispatcher<{
    submitRevision: { feedback: string; toggles: Record<string, string> };
  }>();

  // Derive current revision number from previousVersion
  $: currentRevision = previousVersion; // submitting = revision #previousVersion
  $: revisionsLeft = maxRevisions - previousVersion + 1;

  let feedback = '';

  // Toggle groups — each group has a key and one or zero active value
  type ToggleGroup = {
    key: string;
    label: string;
    options: string[];
  };

  const toggleGroups: ToggleGroup[] = [
    { key: 'layout', label: 'Layout', options: ['Centered', 'Left-aligned', 'Asymmetric'] },
    { key: 'mood', label: 'Mood', options: ['Warmer', 'Cooler', 'Bolder', 'Softer'] },
    { key: 'textSize', label: 'Text size', options: ['Larger', 'Smaller'] },
    { key: 'density', label: 'Density', options: ['More whitespace', 'More content'] },
  ];

  // Active toggle per group key — empty string = none selected
  let activeToggles: Record<string, string> = {};
  toggleGroups.forEach(g => { activeToggles[g.key] = ''; });

  function toggleOption(groupKey: string, option: string) {
    // clicking active option deselects it
    if (activeToggles[groupKey] === option) {
      activeToggles[groupKey] = '';
    } else {
      activeToggles[groupKey] = option;
    }
    // trigger reactivity
    activeToggles = { ...activeToggles };
  }

  $: selectedToggles = Object.fromEntries(
    Object.entries(activeToggles).filter(([, v]) => v !== '')
  );

  $: canSubmit = feedback.trim().length > 0 || Object.values(selectedToggles).length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    dispatch('submitRevision', {
      feedback: feedback.trim(),
      toggles: selectedToggles,
    });
  }
</script>

<div class="rp">
  <!-- Header -->
  <div class="rp-header">
    <div>
      <span class="rp-label">REVISION REQUEST</span>
      <div class="rp-title">What would you like changed?</div>
    </div>
    <div class="rp-counter">
      Revision {currentRevision} of {maxRevisions}
    </div>
  </div>

  <!-- Side-by-side image comparison -->
  <div class="rp-compare">
    <!-- Previous version (left, dimmed) -->
    <div class="rp-compare-side rp-compare-side--prev">
      <div class="rp-compare-label">
        <span class="rp-tag">V{previousVersion}</span>
        <span class="rp-compare-tag-label">Current</span>
      </div>
      <div class="rp-image-wrap rp-image-wrap--dimmed">
        {#if previousImageUrl}
          <img class="rp-image" src={previousImageUrl} alt="Version {previousVersion}" />
        {:else}
          <div class="rp-image-empty">
            <span class="rp-empty-icon">✦</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Arrow divider -->
    <div class="rp-arrow" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 10h12M12 6l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>
    </div>

    <!-- New version slot (right, empty) -->
    <div class="rp-compare-side rp-compare-side--next">
      <div class="rp-compare-label">
        <span class="rp-tag rp-tag--next">V{previousVersion + 1}</span>
        <span class="rp-compare-tag-label">Revised</span>
      </div>
      <div class="rp-image-wrap rp-image-wrap--empty">
        <div class="rp-image-empty">
          <span class="rp-empty-icon rp-empty-icon--dim">✦</span>
          <span class="rp-empty-text">After revision</span>
        </div>
      </div>
    </div>
  </div>

  <!-- Feedback textarea -->
  <div class="rp-card">
    <span class="rp-label">DESCRIBE THE CHANGE</span>
    <textarea
      class="rp-textarea"
      placeholder="Describe what to change..."
      rows="4"
      bind:value={feedback}
    ></textarea>
  </div>

  <!-- Toggle pills -->
  <div class="rp-card">
    <span class="rp-label">QUICK ADJUSTMENTS</span>
    <div class="rp-toggles">
      {#each toggleGroups as group}
        <div class="rp-toggle-group">
          <span class="rp-toggle-label">{group.label}</span>
          <div class="rp-pills">
            {#each group.options as option}
              <button
                class="rp-pill"
                class:rp-pill--active={activeToggles[group.key] === option}
                on:click={() => toggleOption(group.key, option)}
              >{option}</button>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </div>

  <!-- Submit -->
  <div class="rp-actions">
    {#if revisionsLeft <= 1}
      <span class="rp-warning">This is your final revision</span>
    {/if}
    <button
      class="rp-btn rp-btn--primary"
      disabled={!canSubmit}
      on:click={handleSubmit}
    >
      Submit Revision
    </button>
  </div>
</div>

<style>
  .rp {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
  }

  /* Header */
  .rp-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 12px;
  }

  .rp-title {
    font-size: 15px;
    font-weight: 600;
    color: #ededef;
    margin-top: 4px;
  }

  .rp-counter {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: #4a4a50;
    white-space: nowrap;
    padding: 5px 10px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    align-self: flex-start;
    margin-top: 2px;
  }

  /* Side-by-side compare */
  .rp-compare {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    gap: 10px;
    align-items: center;
  }

  .rp-compare-side {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .rp-compare-label {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .rp-tag {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 3px 7px;
    border-radius: 4px;
    background: rgba(232, 70, 74, 0.1);
    color: #e8464a;
    border: 1px solid rgba(232, 70, 74, 0.18);
  }

  .rp-tag--next {
    background: rgba(127, 200, 169, 0.08);
    color: #7fc8a9;
    border-color: rgba(127, 200, 169, 0.18);
  }

  .rp-compare-tag-label {
    font-size: 10px;
    color: #4a4a50;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .rp-image-wrap {
    width: 100%;
    aspect-ratio: 4 / 5;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.07);
  }

  .rp-image-wrap--dimmed {
    opacity: 0.6;
  }

  .rp-image-wrap--empty {
    background: rgba(255, 255, 255, 0.015);
    border-style: dashed;
    border-color: rgba(255, 255, 255, 0.06);
  }

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
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
  }

  .rp-empty-icon {
    font-size: 22px;
    opacity: 0.25;
  }

  .rp-empty-icon--dim {
    opacity: 0.1;
  }

  .rp-empty-text {
    font-size: 10px;
    color: #4a4a50;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  /* Arrow */
  .rp-arrow {
    color: #4a4a50;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  /* Card */
  .rp-card {
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .rp-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
  }

  /* Textarea */
  .rp-textarea {
    width: 100%;
    padding: 11px 13px;
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.08);
    color: #ededef;
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    line-height: 1.55;
    resize: vertical;
    min-height: 90px;
    box-sizing: border-box;
    transition: border-color 0.15s;
  }
  .rp-textarea::placeholder {
    color: #4a4a50;
  }
  .rp-textarea:focus {
    outline: none;
    border-color: rgba(232, 70, 74, 0.3);
  }

  /* Toggles */
  .rp-toggles {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .rp-toggle-group {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .rp-toggle-label {
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a4a50;
    min-width: 68px;
    flex-shrink: 0;
  }

  .rp-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
    background: rgba(255, 255, 255, 0.02);
    border-radius: 8px;
    padding: 2px;
  }

  .rp-pill {
    padding: 5px 11px;
    border-radius: 6px;
    border: none;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.04em;
    cursor: pointer;
    color: #4a4a50;
    background: transparent;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .rp-pill:hover {
    color: #8a8a90;
    background: rgba(255, 255, 255, 0.04);
  }

  .rp-pill--active {
    background: rgba(232, 70, 74, 0.12);
    color: #e8464a;
  }

  .rp-pill--active:hover {
    background: rgba(232, 70, 74, 0.18);
    color: #e8464a;
  }

  /* Actions */
  .rp-actions {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 12px;
    padding-top: 4px;
  }

  .rp-warning {
    font-size: 11px;
    color: #f59e0b;
    font-family: 'Geist Mono Variable', 'SF Mono', 'Courier New', monospace;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .rp-btn {
    padding: 9px 20px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;
  }

  .rp-btn--primary {
    background: rgba(232, 70, 74, 0.15);
    border: 1px solid rgba(232, 70, 74, 0.3);
    color: #e8464a;
  }
  .rp-btn--primary:hover:not(:disabled) {
    background: rgba(232, 70, 74, 0.22);
    border-color: rgba(232, 70, 74, 0.45);
  }
  .rp-btn--primary:disabled {
    opacity: 0.35;
    cursor: not-allowed;
  }

  @media (max-width: 540px) {
    .rp-compare {
      grid-template-columns: 1fr;
    }
    .rp-arrow {
      display: none;
    }
    .rp-compare-side--next {
      display: none;
    }
    .rp-toggle-group {
      flex-direction: column;
      align-items: flex-start;
    }
    .rp-toggle-label {
      min-width: unset;
    }
  }
</style>
