<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let igPostRate = 0;
  export let igStoryRate = 0;
  export let igReelRate = 0;
  export let whatsappRate = 0;
  export let available = false;

  const dispatch = createEventDispatcher();

  function save() {
    dispatch('save', {
      ig_post_rate_inr: igPostRate,
      ig_story_rate_inr: igStoryRate,
      ig_reel_rate_inr: igReelRate,
      whatsapp_intro_rate_inr: whatsappRate,
      available,
    });
  }

  const items = [
    { emoji: '📸', label: 'Instagram Post' },
    { emoji: '📱', label: 'Instagram Story' },
    { emoji: '🎬', label: 'Instagram Reel' },
    { emoji: '💬', label: 'WhatsApp Intro' },
  ];
</script>

<div class="rate-card">
  <div class="rate-header">
    <h3 class="rate-title">Your Rates</h3>
    <label class="rate-toggle">
      <input type="checkbox" bind:checked={available} on:change={save} />
      <span class="rate-toggle-label">{available ? 'Open to deals' : 'Not available'}</span>
    </label>
  </div>

  <div class="rate-rows">
    <div class="rate-row">
      <span class="rate-emoji">{items[0].emoji}</span>
      <span class="rate-label">{items[0].label}</span>
      <div class="rate-input-wrap">
        <span class="rate-currency">₹</span>
        <input type="number" class="rate-input" bind:value={igPostRate} on:blur={save} min="0" />
      </div>
    </div>
    <div class="rate-row">
      <span class="rate-emoji">{items[1].emoji}</span>
      <span class="rate-label">{items[1].label}</span>
      <div class="rate-input-wrap">
        <span class="rate-currency">₹</span>
        <input type="number" class="rate-input" bind:value={igStoryRate} on:blur={save} min="0" />
      </div>
    </div>
    <div class="rate-row">
      <span class="rate-emoji">{items[2].emoji}</span>
      <span class="rate-label">{items[2].label}</span>
      <div class="rate-input-wrap">
        <span class="rate-currency">₹</span>
        <input type="number" class="rate-input" bind:value={igReelRate} on:blur={save} min="0" />
      </div>
    </div>
    <div class="rate-row">
      <span class="rate-emoji">{items[3].emoji}</span>
      <span class="rate-label">{items[3].label}</span>
      <div class="rate-input-wrap">
        <span class="rate-currency">₹</span>
        <input type="number" class="rate-input" bind:value={whatsappRate} on:blur={save} min="0" />
      </div>
    </div>
  </div>
</div>

<style>
  .rate-card {
    background: var(--glass-light); border: 1px solid var(--border-subtle);
    border-radius: 16px; padding: 20px;
    backdrop-filter: blur(var(--blur-medium)); -webkit-backdrop-filter: blur(var(--blur-medium));
  }
  .rate-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
  .rate-title { font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0; }
  .rate-toggle { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .rate-toggle input { accent-color: #4D7CFF; width: 16px; height: 16px; }
  .rate-toggle-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
  .rate-rows { display: flex; flex-direction: column; gap: 12px; }
  .rate-row { display: flex; align-items: center; gap: 10px; }
  .rate-emoji { font-size: 18px; flex-shrink: 0; }
  .rate-label { font-size: 13px; color: var(--text-secondary); flex: 1; }
  .rate-input-wrap {
    display: flex; align-items: center; gap: 4px;
    background: var(--glass-medium); border: 1px solid var(--border-subtle);
    border-radius: 10px; padding: 6px 10px; width: 100px;
  }
  .rate-currency { font-size: 14px; color: var(--text-muted); font-family: var(--font-mono); }
  .rate-input {
    width: 60px; background: transparent; border: none; outline: none;
    font-size: 14px; font-family: var(--font-mono); color: var(--text-primary);
  }
  .rate-input::-webkit-inner-spin-button { -webkit-appearance: none; }
</style>
