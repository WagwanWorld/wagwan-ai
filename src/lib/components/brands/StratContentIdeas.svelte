<script lang="ts">
  export let ideas: Array<{ title: string; format: string; hook: string; why: string }> = [];
  export let captionStyle: string = '';
  export let contentPillars: string[] = [];
</script>

<div class="ideas">
  {#if captionStyle}
    <p class="voice-note">Voice: {captionStyle}</p>
  {/if}

  {#if contentPillars.length > 0}
    <div class="pillars">
      <span class="label">Content Pillars</span>
      <div class="pillar-tags">
        {#each contentPillars as pillar}
          <span class="tag">{pillar}</span>
        {/each}
      </div>
    </div>
  {/if}

  {#if ideas.length > 0}
    <div class="ideas-list">
      {#each ideas as idea, i}
        <article class="idea-row" style="--i:{i}">
          <div class="idea-top">
            <span class="idea-num">{String(i + 1).padStart(2, '0')}</span>
            <span class="idea-format" class:format-reel={idea.format === 'REEL'}>{idea.format}</span>
          </div>
          <h4 class="idea-title">{idea.title}</h4>
          <p class="idea-hook">&ldquo;{idea.hook}&rdquo;</p>
          <p class="idea-why">{idea.why}</p>
        </article>
      {/each}
    </div>
  {:else}
    <p class="no-data">Connect your Instagram to get AI-generated content ideas tailored to your brand.</p>
  {/if}
</div>

<style>
  .ideas {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }

  .voice-note {
    font-size: 13px;
    font-style: italic;
    color: var(--g-text-3);
    margin: 0;
    line-height: 1.5;
  }

  /* Label */
  .label {
    font-size: var(--g-label-size);
    font-weight: var(--g-label-weight);
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    color: var(--g-label-color);
  }

  /* Pillars */
  .pillars {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .pillar-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .tag {
    font-size: 10px;
    padding: 4px 12px;
    border-radius: 9px;
    background: rgba(255,255,255,0.025);
    color: var(--g-text-4);
    border: 1px solid rgba(255,255,255,0.02);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* Ideas list */
  .ideas-list {
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .idea-row {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 16px 0;
    border-top: 1px solid rgba(255,255,255,0.025);
    opacity: 0;
    transform: translateY(8px);
    animation: reveal var(--g-dur-fast, 0.4s) var(--g-ease) forwards;
    animation-delay: calc(var(--i, 0) * 60ms);
  }
  @keyframes reveal { to { opacity: 1; transform: translateY(0); } }

  .idea-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .idea-num {
    font-size: 16px;
    font-weight: 300;
    letter-spacing: -0.04em;
    color: var(--g-text-ghost);
  }
  .idea-format {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: var(--g-label-spacing);
    text-transform: uppercase;
    padding: 4px 12px;
    border-radius: 9px;
    background: rgba(255,255,255,0.025);
    border: 1px solid rgba(255,255,255,0.02);
    color: var(--g-text-4);
  }
  .format-reel {
    color: var(--g-num-rose, rgba(251,113,133,0.78));
    border-color: rgba(244,63,94,0.1);
    background: rgba(244,63,94,0.04);
  }

  .idea-title {
    font-size: 15px;
    font-weight: 400;
    color: var(--g-text);
    margin: 0;
    line-height: 1.35;
  }
  .idea-hook {
    font-size: 13px;
    font-style: italic;
    color: var(--g-text-3);
    margin: 0;
    line-height: 1.5;
  }
  .idea-why {
    font-size: 11px;
    color: var(--g-text-ghost);
    margin: 0;
    line-height: 1.55;
  }

  .no-data {
    font-size: 13px;
    color: var(--g-text-4);
    margin: 0;
  }
</style>
