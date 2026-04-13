<script lang="ts">
  export let emoji = '';
  export let text = '';
  export let highlight = false;
</script>

<div class="trajectory-card" class:highlight>
  {#if emoji}<span class="trajectory-emoji">{emoji}</span>{/if}
  <p class="trajectory-text">{text}</p>
</div>

<style>
  .trajectory-card {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 16px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 14px;
    backdrop-filter: blur(var(--blur-light));
    -webkit-backdrop-filter: blur(var(--blur-light));
    transition: transform 0.2s, border-color 0.2s;
  }
  .trajectory-card:hover {
    transform: translateY(-2px);
    border-color: var(--border-strong, rgba(255,255,255,0.14));
  }

  .trajectory-card.highlight {
    background: linear-gradient(135deg, rgba(255,77,77,0.08), rgba(77,124,255,0.06));
    border-color: rgba(255,77,77,0.25);
    box-shadow: 0 4px 20px rgba(255,77,77,0.1);
  }

  .trajectory-emoji {
    font-size: 20px;
    flex-shrink: 0;
    line-height: 1;
    margin-top: 1px;
  }

  .trajectory-text {
    font-size: 14px;
    color: var(--text-primary);
    line-height: 1.5;
    margin: 0;
  }
</style>
