<script lang="ts">
  export let name = '';
  export let city = '';
  export let archetype = '';
  export let vibeTags: string[] = [];
  export let integrityScore = 0;
  export let followers = 0;
  export let posts = 0;
  export let rates: { ig_post_rate_inr?: number; ig_story_rate_inr?: number; ig_reel_rate_inr?: number } | null = null;
  export let visibleSections: string[] = [];
</script>

<div class="pp-card">
  <div class="pp-header">
    <div class="pp-avatar">{name.charAt(0).toUpperCase()}</div>
    <div>
      <div class="pp-name">{name}</div>
      {#if city}<div class="pp-city">{city}</div>{/if}
    </div>
    <div class="pp-score-badge">{integrityScore}</div>
  </div>

  {#if archetype}
    <p class="pp-archetype">{archetype}</p>
  {/if}

  {#if vibeTags.length}
    <div class="pp-tags">
      {#each vibeTags.slice(0, 4) as tag, i}
        <span class="pp-tag" class:pp-tag--red={i%3===0} class:pp-tag--blue={i%3===1} class:pp-tag--gold={i%3===2}>{tag}</span>
      {/each}
    </div>
  {/if}

  {#if followers || posts}
    <div class="pp-stats">
      {#if followers}<span>{followers.toLocaleString()} followers</span>{/if}
      {#if posts}<span>{posts} posts</span>{/if}
    </div>
  {/if}

  {#if rates && (rates.ig_post_rate_inr || rates.ig_story_rate_inr || rates.ig_reel_rate_inr)}
    <div class="pp-rates">
      {#if rates.ig_post_rate_inr}<span>📸 ₹{rates.ig_post_rate_inr}</span>{/if}
      {#if rates.ig_story_rate_inr}<span>📱 ₹{rates.ig_story_rate_inr}</span>{/if}
      {#if rates.ig_reel_rate_inr}<span>🎬 ₹{rates.ig_reel_rate_inr}</span>{/if}
    </div>
  {/if}

  {#if visibleSections.length}
    <div class="pp-sections">
      <span class="pp-sections-label">Visible signals:</span>
      {#each visibleSections as section}
        <span class="pp-section-pill">{section}</span>
      {/each}
    </div>
  {/if}

  <p class="pp-footer">This is what brands see when they find your portrait.</p>
</div>

<style>
  .pp-card {
    background: var(--glass-light); border: 1px solid var(--border-subtle);
    border-radius: 16px; padding: 24px;
    backdrop-filter: blur(var(--blur-medium)); -webkit-backdrop-filter: blur(var(--blur-medium));
    display: flex; flex-direction: column; gap: 12px;
  }
  .pp-header { display: flex; align-items: center; gap: 12px; }
  .pp-avatar {
    width: 48px; height: 48px; border-radius: 50%; flex-shrink: 0;
    background: linear-gradient(135deg, #FF4D4D, #FFB84D);
    display: flex; align-items: center; justify-content: center;
    font-size: 20px; font-weight: 800; color: white;
  }
  .pp-name { font-size: 16px; font-weight: 700; color: var(--text-primary); }
  .pp-city { font-size: 12px; color: var(--text-muted); }
  .pp-score-badge {
    margin-left: auto; width: 36px; height: 36px; border-radius: 50%;
    background: rgba(77,124,255,0.12); border: 2px solid rgba(77,124,255,0.35);
    display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 800; font-family: var(--font-mono); color: #6B9AFF;
  }
  .pp-archetype { font-size: 13px; color: var(--text-secondary); margin: 0; font-style: italic; }
  .pp-tags { display: flex; flex-wrap: wrap; gap: 6px; }
  .pp-tag { font-size: 10px; padding: 3px 10px; border-radius: 100px; font-weight: 600; }
  .pp-tag--red { background: rgba(255,77,77,0.12); color: #FF6B6B; border: 1px solid rgba(255,77,77,0.25); }
  .pp-tag--blue { background: rgba(77,124,255,0.12); color: #6B9AFF; border: 1px solid rgba(77,124,255,0.25); }
  .pp-tag--gold { background: rgba(255,184,77,0.12); color: #FFC46B; border: 1px solid rgba(255,184,77,0.25); }
  .pp-stats { display: flex; gap: 12px; font-size: 12px; color: var(--text-muted); font-family: var(--font-mono); }
  .pp-rates { display: flex; gap: 12px; font-size: 12px; font-family: var(--font-mono); color: var(--text-secondary); }
  .pp-sections { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .pp-sections-label { font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
  .pp-section-pill {
    font-size: 10px; padding: 2px 8px; border-radius: 100px;
    background: var(--glass-medium); color: var(--text-muted); border: 1px solid var(--border-subtle);
  }
  .pp-footer { font-size: 11px; color: var(--text-muted); text-align: center; margin: 8px 0 0; font-style: italic; }
</style>
