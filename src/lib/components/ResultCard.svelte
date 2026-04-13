<script lang="ts">
  import { profile } from '$lib/stores/profile';
  import { reminders } from '$lib/stores/reminders';
  import type { ResultCard } from '$lib/utils';
  import { categoryToGrad, getYouTubeId } from '$lib/utils';
  import { suggestionHeroUrl } from '$lib/suggestionImagery';
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher<{ remind: { text: string; url: string } }>();

  export let card: ResultCard;
  export let tall = false;      // tall portrait card for home scroll
  export let compact = false;   // compact horizontal mini layout

  let saved = false;
  $: saved = $profile.savedItems.some(s => s.id === cardId);

  // Stable ID from title + url
  $: cardId = btoa(card.title + card.url).slice(0, 16);

  function toggleSave() {
    if (saved) {
      profile.unsave(cardId);
    } else {
      profile.save({
        id: cardId,
        title: card.title,
        url: card.url,
        category: card.category,
        emoji: card.emoji,
        savedAt: new Date().toISOString(),
      });
    }
  }

  function openUrl() {
    let url: string;
    if (card.url && card.url.startsWith('http')) {
      url = card.url;
    } else if (card.category === 'video') {
      // Fallback: YouTube search for the video title
      url = `https://www.youtube.com/results?search_query=${encodeURIComponent(card.title)}`;
    } else {
      url = `https://www.google.com/search?q=${encodeURIComponent(card.title)}`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  let reminded = false;
  function addReminder() {
    reminders.add(card.title, undefined, card.emoji || '🔔');
    reminded = true;
    setTimeout(() => (reminded = false), 2000);
    dispatch('remind', { text: card.title, url: card.url });
  }

  $: gradClass = categoryToGrad(card.category, card.image_hint);
  $: scoreClass = card.match_score >= 90 ? 'green' : '';

  // Image error handling
  let imgError = false;
  function handleImgError() {
    imgError = true;
  }

  $: ytId = card.category === 'video' ? getYouTubeId(card.url) : null;
  $: ytThumb = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : null;
  let thumbError = false;

  $: heroFallback = suggestionHeroUrl(card.category, 480, 640);
</script>

{#if tall}
  {#if card.category === 'video'}
  <!-- ── YouTube video card ── -->
  <div
    class="tall-card"
    on:click={openUrl}
    on:keydown={e => e.key === 'Enter' && openUrl()}
    role="button"
    tabindex="0"
  >
    <!-- Thumbnail or gradient fallback -->
    {#if ytThumb && !thumbError}
      <img
        src={ytThumb}
        alt={card.title}
        class="tall-card-img"
        style="object-fit:cover;"
        on:error={() => (thumbError = true)}
        referrerpolicy="no-referrer"
        loading="lazy"
      />
    {:else}
      <div
        class="grad-video tall-card-img"
        style="display:flex;align-items:center;justify-content:center;font-size:56px;background-image:linear-gradient(to top,rgba(0,0,0,0.45),transparent),url({heroFallback});background-size:cover;background-position:center;"
      >▶️</div>
    {/if}

    <!-- Dark scrim -->
    <div class="tall-card-overlay"></div>

    <!-- YouTube badge top-right -->
    <div style="position:absolute;top:10px;right:10px;background:#FF0000;border-radius:4px;padding:2px 5px;display:flex;align-items:center;gap:3px;pointer-events:none;">
      <svg width="10" height="8" viewBox="0 0 90 63" fill="white"><path d="M88.2 9.7a11.2 11.2 0 0 0-7.9-7.9C73.4 0 45 0 45 0S16.6 0 9.7 1.8A11.2 11.2 0 0 0 1.8 9.7C0 16.6 0 31.5 0 31.5s0 14.9 1.8 21.8a11.2 11.2 0 0 0 7.9 7.9C16.6 63 45 63 45 63s28.4 0 35.3-1.8a11.2 11.2 0 0 0 7.9-7.9C90 46.4 90 31.5 90 31.5S90 16.6 88.2 9.7z"/><polygon fill="#FF0000" points="36,45 59,31.5 36,18"/><polygon fill="white" points="36,45 59,31.5 36,18"/></svg>
    </div>

    <!-- Play button centre -->
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-60%);width:48px;height:48px;border-radius:50%;background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);border:2px solid rgba(255,255,255,0.35);display:flex;align-items:center;justify-content:center;pointer-events:none;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21"/></svg>
    </div>

    <!-- Bottom info -->
    <div class="tall-card-body">
      <div style="font-size:12px;font-weight:700;color:#fff;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:5px;">
        {card.title}
      </div>
      <span class="match-badge {scoreClass}" style="font-size:10px;">{card.match_score}%</span>
    </div>
  </div>

  {:else}
  <!-- Tall portrait card (160×240) for home horizontal scroll -->
  <div
    class="tall-card"
    on:click={openUrl}
    on:keydown={e => e.key === 'Enter' && openUrl()}
    role="button"
    tabindex="0"
  >
    {#if card.image_url && !imgError}
      <img
        src={card.image_url}
        alt=""
        class="tall-card-img"
        on:error={handleImgError}
        referrerpolicy="no-referrer"
        loading="lazy"
      />
    {:else}
      <div
        class="tall-card-img"
        style="background-image:linear-gradient(to top,rgba(0,0,0,0.5),rgba(0,0,0,0.15)),url({heroFallback});background-size:cover;background-position:center;"
        aria-hidden="true"
      ></div>
    {/if}

    <!-- Gradient overlay -->
    <div class="tall-card-overlay"></div>

    <!-- Content at bottom -->
    <div class="tall-card-body">
      <!-- Category chip -->
      <div style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.12);border-radius:100px;margin-bottom:6px;">
        <span style="font-size:11px;">{card.emoji}</span>
        <span style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:.4px;">{card.category}</span>
      </div>

      <!-- Title -->
      <div style="font-size:13px;font-weight:700;color:#fff;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:6px;">
        {card.title}
      </div>

      <!-- Match score -->
      <span class="match-badge {scoreClass}" style="font-size:10px;">{card.match_score}%</span>
    </div>
  </div>
  {/if}

{:else if compact}
  <!-- Compact horizontal mini card -->
  <div
    class="w-card w-card-glow cursor-pointer"
    style="min-width:160px;"
    on:click={openUrl}
    on:keydown={e => e.key === 'Enter' && openUrl()}
    role="button"
    tabindex="0"
  >
    <div class="flex flex-col h-full">
      <!-- Image or gradient top -->
      <div class="{gradClass} flex items-center justify-center text-3xl" style="height:90px;position:relative;">
        {card.emoji}
        {#if card.image_url && !imgError}
          <img src={card.image_url} alt={card.title}
            style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;"
            referrerpolicy="no-referrer" loading="lazy" on:error={handleImgError} />
        {/if}
      </div>
      <div class="p-3 flex flex-col gap-1.5 flex-1">
        <div class="text-sm font-bold leading-tight" style="color:var(--text)">{card.title}</div>
        <div class="text-xs" style="color:var(--text2)">{card.price}</div>
        <span class="match-badge {scoreClass} text-xs">{card.match_score}%</span>
      </div>
    </div>
  </div>

{:else}
  <!-- Compact glassmorphic card (AI chat) — whole card tappable -->
  <div
    class="rc-glass"
    on:click={openUrl}
    on:keydown={e => e.key === 'Enter' && openUrl()}
    role="button"
    tabindex="0"
  >
    <!-- Thumbnail -->
    <div class="rc-thumb">
      {#if card.image_url && !imgError}
        <img
          src={card.image_url}
          alt=""
          class="rc-thumb-img"
          on:error={handleImgError}
          referrerpolicy="no-referrer"
          loading="lazy"
        />
      {:else}
        <div
          class="rc-thumb-img"
          style="background-image:url({suggestionHeroUrl(card.category, 96, 96)});background-size:cover;background-position:center;"
          aria-hidden="true"
        ></div>
      {/if}
    </div>

    <!-- Text content -->
    <div class="rc-body">
      <span class="rc-title">{card.title}</span>
      <span class="rc-reason">{card.match_reason}</span>
      <span class="rc-meta">
        {#if card.price}<span class="rc-price">{card.price}</span>{/if}
        <span class="rc-cat">{card.emoji} {card.category}</span>
      </span>
    </div>

    <!-- Save heart -->
    <button
      class="rc-save"
      on:click|stopPropagation={toggleSave}
      aria-label={saved ? 'Unsave' : 'Save'}
    >
      {saved ? '♥' : '♡'}
    </button>
  </div>
{/if}

<style>
  .rc-glass {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.08);
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition:
      background 0.25s ease,
      border-color 0.25s ease,
      transform 0.22s cubic-bezier(0.34, 1.4, 0.64, 1),
      box-shadow 0.25s ease;
  }

  .rc-glass:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.14);
    box-shadow: 0 4px 24px rgba(0, 0, 0, 0.25);
  }

  .rc-glass:active {
    transform: scale(0.985);
    transition-duration: 0.1s;
  }

  .rc-thumb {
    flex-shrink: 0;
    width: 48px;
    height: 48px;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.06);
  }

  .rc-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .rc-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .rc-title {
    font-size: 14px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.92);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rc-reason {
    font-size: 12px;
    font-weight: 400;
    font-style: italic;
    color: rgba(255, 255, 255, 0.45);
    line-height: 1.35;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .rc-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 1px;
  }

  .rc-price {
    font-size: 12px;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.7);
  }

  .rc-cat {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: rgba(255, 255, 255, 0.32);
  }

  .rc-save {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    border: none;
    background: rgba(255, 255, 255, 0.05);
    color: rgba(229, 0, 26, 0.55);
    font-size: 15px;
    cursor: pointer;
    transition: background 0.2s, color 0.2s, transform 0.15s;
  }

  .rc-save:hover {
    background: rgba(229, 0, 26, 0.1);
    color: rgba(229, 0, 26, 0.85);
    transform: scale(1.1);
  }
</style>
