<script lang="ts">
  import X from 'phosphor-svelte/lib/X';
  import { createEventDispatcher } from 'svelte';

  export let selectedCount: number;
  export let estimatedCost: number | null;
  export let brandName: string = '';

  const dispatch = createEventDispatcher<{
    confirm: { title: string; creativeText: string; rewardInr: number; channels: { email: boolean; in_app: boolean; whatsapp: boolean } };
    close: void;
  }>();

  let title = '';
  let creativeText = '';
  let rewardInr = 50;
  let channelEmail = false;
  let channelInApp = true;
  let submitting = false;
  let errorMsg = '';

  function handleSubmit() {
    errorMsg = '';
    if (!title.trim()) { errorMsg = 'Name this campaign.'; return; }
    submitting = true;
    dispatch('confirm', { title: title.trim(), creativeText: creativeText.trim(), rewardInr, channels: { email: channelEmail, in_app: channelInApp, whatsapp: false } });
  }

  function formatINR(n: number): string { return '₹' + n.toLocaleString('en-IN'); }
</script>

<!-- svelte-ignore a11y-click-events-have-key-events -->
<div class="modal-backdrop" on:click={() => dispatch('close')} role="presentation">
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-card" on:click|stopPropagation role="dialog" aria-label="Launch campaign">
    <div class="modal-header">
      <h3 class="modal-title">Launch Campaign</h3>
      <button type="button" class="modal-close" on:click={() => dispatch('close')} aria-label="Close"><X size={18} /></button>
    </div>
    <form class="modal-body" on:submit|preventDefault={handleSubmit}>
      <div class="field">
        <label for="campaign-title">Campaign name</label>
        <input id="campaign-title" type="text" bind:value={title} placeholder="e.g. Summer Drop Promo" />
      </div>
      <div class="field">
        <label for="creative-text">Creative brief</label>
        <textarea id="creative-text" bind:value={creativeText} placeholder="What should creators know about this campaign?" rows="3"></textarea>
      </div>
      <div class="field">
        <label for="reward-slider">Reward per person: {formatINR(rewardInr)}</label>
        <input id="reward-slider" type="range" min="10" max="500" step="10" bind:value={rewardInr} />
        <div class="range-labels"><span>₹10</span><span>₹500</span></div>
      </div>
      <div class="field">
        <label>Channels</label>
        <div class="channel-row">
          <label class="channel-toggle"><input type="checkbox" bind:checked={channelInApp} /><span>In-app</span></label>
          <label class="channel-toggle"><input type="checkbox" bind:checked={channelEmail} /><span>Email</span></label>
          <label class="channel-toggle channel-toggle--disabled"><input type="checkbox" disabled /><span>WhatsApp <em>(soon)</em></span></label>
        </div>
      </div>
      {#if errorMsg}<p class="error-msg">{errorMsg}</p>{/if}
      <div class="modal-footer">
        <p class="footer-summary">Launching to <strong>{selectedCount}</strong> creators{#if estimatedCost != null} &middot; Est. {formatINR(estimatedCost)}{/if}</p>
        <button type="submit" class="confirm-btn" disabled={submitting}>{submitting ? 'Launching...' : 'Confirm & Launch'}</button>
      </div>
    </form>
  </div>
</div>

<style>
  .modal-backdrop { position: fixed; inset: 0; z-index: 80; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 24px; animation: fade-in 0.2s ease-out; }
  @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
  .modal-card { width: 100%; max-width: 480px; background: var(--bg-elevated, #1a1a1e); border: 1px solid var(--border-subtle); border-radius: 20px; overflow: hidden; animation: modal-enter 0.3s cubic-bezier(0.32, 0.72, 0, 1); }
  @keyframes modal-enter { from { opacity: 0; transform: scale(0.95) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
  .modal-header { display: flex; justify-content: space-between; align-items: center; padding: 20px 24px; border-bottom: 1px solid var(--border-subtle); }
  .modal-title { font-size: 16px; font-weight: 600; color: var(--text-primary); margin: 0; }
  .modal-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 6px; transition: color 0.15s; }
  .modal-close:hover { color: var(--text-primary); }
  .modal-body { padding: 24px; display: flex; flex-direction: column; gap: 18px; }
  .field { display: flex; flex-direction: column; gap: 6px; }
  .field label { font-size: 12px; font-weight: 500; color: var(--text-secondary); }
  .field input[type="text"], .field textarea { background: var(--bg-primary, #0a0a0c); border: 1px solid var(--border-subtle); border-radius: 10px; padding: 10px 14px; font-size: 14px; color: var(--text-primary); font-family: inherit; outline: none; transition: border-color 0.2s; }
  .field input[type="text"]:focus, .field textarea:focus { border-color: rgba(77, 124, 255, 0.4); }
  .field textarea { resize: vertical; min-height: 56px; line-height: 1.5; }
  .field input[type="text"]::placeholder, .field textarea::placeholder { color: var(--text-muted); }
  .field input[type="range"] { -webkit-appearance: none; appearance: none; width: 100%; height: 6px; border-radius: 3px; background: rgba(255,255,255,0.08); outline: none; }
  .field input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--accent-secondary, #4D7CFF); cursor: pointer; }
  .range-labels { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); }
  .channel-row { display: flex; gap: 16px; }
  .channel-toggle { display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--text-secondary); cursor: pointer; }
  .channel-toggle--disabled { opacity: 0.4; cursor: default; }
  .channel-toggle em { font-size: 10px; color: var(--text-muted); }
  .error-msg { font-size: 13px; color: #f87171; margin: 0; }
  .modal-footer { display: flex; flex-direction: column; gap: 12px; padding-top: 8px; border-top: 1px solid var(--border-subtle); }
  .footer-summary { font-size: 13px; color: var(--text-muted); margin: 0; text-align: center; }
  .footer-summary strong { color: var(--text-primary); }
  .confirm-btn { width: 100%; padding: 12px 20px; border: none; border-radius: 12px; background: linear-gradient(135deg, var(--accent-primary, #FF4D4D), var(--accent-tertiary, #FFB84D)); color: white; font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer; transition: opacity 0.2s, transform 0.2s; }
  .confirm-btn:hover:not(:disabled) { opacity: 0.92; }
  .confirm-btn:active:not(:disabled) { transform: scale(0.98); }
  .confirm-btn:disabled { opacity: 0.4; cursor: default; }
</style>
