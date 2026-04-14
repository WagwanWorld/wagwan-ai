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
