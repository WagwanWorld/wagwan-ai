<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';

  const dispatch = createEventDispatcher<{
    submit: { brandName: string; website: string; instagram: string; description: string };
  }>();

  let brandName = '';
  let website = '';
  let instagram = '';
  let description = '';
  let submitting = false;
  let visible = false;

  onMount(() => { setTimeout(() => { visible = true; }, 100); });

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

  const EXAMPLES = [
    'Sustainable sneakers for urban runners',
    'AI writing tools for content creators',
    'Premium coffee subscription for remote workers',
  ];

  function useExample(text: string) {
    description = text;
  }
</script>

<div class="intake-backdrop" class:visible>
  <!-- Decorative accent -->
  <div class="intake-glow" aria-hidden="true"></div>

  <form class="intake-card" on:submit|preventDefault={handleSubmit}>
    <!-- Header -->
    <div class="intake-header">
      <div class="intake-badge">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="2.5" fill="var(--accent-secondary)"/>
          <circle cx="7" cy="7" r="6" stroke="var(--accent-secondary)" stroke-width="0.8" opacity="0.3"/>
        </svg>
        <span>Audience matching</span>
      </div>
      <h1 class="intake-title">Who are you<br/>trying to reach?</h1>
      <p class="intake-sub">Tell us a little about your brand. We'll find creators whose audiences actually match.</p>
    </div>

    <!-- Form -->
    <div class="intake-fields">
      <div class="field-row">
        <div class="field">
          <label for="brand-name">Brand name</label>
          <input id="brand-name" type="text" bind:value={brandName} placeholder="Your brand" />
        </div>
        <div class="field">
          <label for="instagram">Instagram</label>
          <div class="ig-wrap">
            <span class="ig-at">@</span>
            <input id="instagram" type="text" bind:value={instagram} placeholder="handle" />
          </div>
        </div>
      </div>

      <div class="field">
        <label for="website">Website <span class="optional">(optional)</span></label>
        <input id="website" type="url" bind:value={website} placeholder="https://" />
      </div>

      <div class="field field--main">
        <label for="description">What do you sell? <span class="required">*</span></label>
        <textarea
          id="description"
          bind:value={description}
          placeholder="Describe your product and who it's for..."
          rows="2"
          required
        ></textarea>
        {#if !description}
          <div class="examples">
            <span class="examples-label">Try:</span>
            {#each EXAMPLES as ex, i}
              <button type="button" class="example-chip" style="animation-delay:{0.4 + i * 0.08}s" on:click={() => useExample(ex)}>
                {ex}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Submit -->
    <button class="intake-btn" type="submit" disabled={!description.trim() || submitting}>
      {#if submitting}
        <span class="spinner"></span>
        <span>Matching...</span>
      {:else}
        <span>Find my audience</span>
        <span class="btn-icon">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
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
    padding: 48px 24px;
    position: relative;
    opacity: 0;
    transform: translateY(12px);
    transition: all 0.6s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .intake-backdrop.visible {
    opacity: 1;
    transform: translateY(0);
  }

  .intake-glow {
    position: absolute;
    width: 400px;
    height: 400px;
    top: 10%;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(77,124,255,0.08), rgba(255,77,77,0.04) 50%, transparent 70%);
    pointer-events: none;
    animation: glow-pulse 6s cubic-bezier(0.32, 0.72, 0, 1) infinite;
  }

  @keyframes glow-pulse {
    0%, 100% { opacity: 0.6; transform: translateX(-50%) scale(1); }
    50% { opacity: 1; transform: translateX(-50%) scale(1.1); }
  }

  .intake-card {
    position: relative;
    width: 100%;
    max-width: 480px;
    display: flex;
    flex-direction: column;
    gap: 32px;
    padding: 36px;
    border-radius: 1.5rem;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    box-shadow:
      inset 0 1px 1px rgba(255,255,255,0.06),
      0 16px 48px rgba(0,0,0,0.3);
  }

  /* ── Header ── */
  .intake-header {
    text-align: center;
  }

  .intake-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: var(--accent-secondary);
    margin-bottom: 16px;
  }

  .intake-title {
    font-size: clamp(1.5rem, 4vw, 2rem);
    font-weight: 600;
    letter-spacing: -0.03em;
    line-height: 1.15;
    color: var(--text-primary);
    margin: 0;
  }

  .intake-sub {
    font-size: 0.875rem;
    color: var(--text-muted);
    margin: 12px 0 0;
    line-height: 1.55;
  }

  /* ── Fields ── */
  .intake-fields {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .field-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }

  @media (max-width: 480px) {
    .field-row { grid-template-columns: 1fr; }
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .field label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .optional { color: var(--text-muted); font-weight: 400; }
  .required { color: var(--accent-primary); }

  .field input,
  .field textarea {
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    padding: 11px 14px;
    font-size: 0.875rem;
    color: var(--text-primary);
    font-family: inherit;
    outline: none;
    transition: border-color 0.25s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .field input:focus,
  .field textarea:focus {
    border-color: rgba(77, 124, 255, 0.4);
    box-shadow: 0 0 0 3px rgba(77, 124, 255, 0.08);
  }

  .field input::placeholder,
  .field textarea::placeholder {
    color: var(--text-muted);
  }

  .field textarea {
    resize: vertical;
    min-height: 56px;
    line-height: 1.5;
  }

  .ig-wrap {
    display: flex;
    align-items: center;
    background: var(--bg-primary);
    border: 1px solid var(--border-subtle);
    border-radius: 12px;
    transition: border-color 0.25s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .ig-wrap:focus-within {
    border-color: rgba(77, 124, 255, 0.4);
    box-shadow: 0 0 0 3px rgba(77, 124, 255, 0.08);
  }

  .ig-at {
    padding: 0 0 0 14px;
    color: var(--text-muted);
    font-size: 0.875rem;
    user-select: none;
  }

  .ig-wrap input {
    background: transparent;
    border: none;
    border-radius: 0;
    padding-left: 2px;
    box-shadow: none !important;
  }

  /* ── Examples ── */
  .examples {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
    margin-top: 8px;
  }

  .examples-label {
    font-size: 0.6875rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .example-chip {
    font-size: 0.6875rem;
    padding: 4px 10px;
    border-radius: 9999px;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-secondary);
    font-family: inherit;
    cursor: pointer;
    opacity: 0;
    transform: translateY(4px);
    animation: chip-in 0.35s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    transition: border-color 0.2s, background 0.2s, color 0.2s;
  }

  .example-chip:hover {
    border-color: rgba(77, 124, 255, 0.3);
    background: rgba(77, 124, 255, 0.06);
    color: var(--text-primary);
  }

  @keyframes chip-in {
    to { opacity: 1; transform: translateY(0); }
  }

  /* ── Submit ── */
  .intake-btn {
    width: 100%;
    padding: 14px 20px;
    border: none;
    border-radius: 14px;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-tertiary));
    color: white;
    font-size: 0.9375rem;
    font-weight: 600;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    min-height: 48px;
    transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .intake-btn:hover:not(:disabled) { transform: translateY(-1px); }
  .intake-btn:active:not(:disabled) { transform: scale(0.98); }
  .intake-btn:disabled { opacity: 0.35; cursor: default; }

  .btn-icon {
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .intake-btn:hover:not(:disabled) .btn-icon { transform: translateX(2px); }

  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid rgba(255,255,255,0.3);
    border-top-color: white;
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
</style>
