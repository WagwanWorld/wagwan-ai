<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import ArrowClockwise from 'phosphor-svelte/lib/ArrowClockwise';
  import UserCircle from 'phosphor-svelte/lib/UserCircle';

  export let displayName = '';
  export let photoUrl = null;
  export let avatarInitial = 'W';
  export let oneLiner = '';
  export let archetype = '';
  export let mode = '';
  export let vibeTags = [];
  export let city = '';
  export let loading = false;
  export let regenerating = false;
  export let contradiction = '';  // core_contradiction from identitySnapshot
  export let greeting = '';

  const dispatch = createEventDispatcher();

  let mounted = false;

  onMount(() => {
    mounted = true;
  });

  $: kickerText = [archetype, mode].filter(Boolean).join(' · ');
  $: formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
  $: displayedTags = vibeTags.slice(0, 4);
  $: cityDate = [city, formattedDate].filter(Boolean).join(' \u00b7 ');
</script>

<section class="hero" class:mounted>
  <!-- Action buttons -->
  <div class="actions">
    <button class="action-btn" on:click={() => dispatch('share')}>
      Share &#8599;
    </button>
    <button
      class="action-btn icon-btn"
      on:click={() => dispatch('refresh')}
      class:spinning={regenerating}
      aria-label="Refresh"
    >
      <ArrowClockwise size={14} weight="bold" />
    </button>
    <button class="action-btn icon-btn" aria-label="Profile">
      <UserCircle size={14} weight="bold" />
    </button>
  </div>

  {#if loading}
    <!-- Loading skeleton -->
    <div class="skeleton-wrap">
      <div class="skel skel-kicker"></div>
      <div class="skel skel-headline"></div>
      <div class="skel skel-headline short"></div>
      <div class="skel skel-avatar"></div>
      <div class="skel skel-name"></div>
      <div class="skel-pills">
        <div class="skel skel-pill"></div>
        <div class="skel skel-pill"></div>
        <div class="skel skel-pill"></div>
      </div>
    </div>
  {:else}
    {#if greeting}
      <p class="greeting anim anim-0">{greeting}</p>
    {/if}

    <!-- Kicker -->
    {#if kickerText}
      <p class="kicker anim anim-0">{kickerText}</p>
    {/if}

    <!-- One-liner headline -->
    {#if oneLiner}
      <h1 class="headline anim anim-1">{oneLiner}</h1>
    {/if}

    <!-- Contradiction / reframe -->
    {#if contradiction}
      <p class="contradiction anim anim-1b">{contradiction}</p>
    {/if}

    <!-- Profile photo with gradient ring -->
    <div class="avatar-wrap anim anim-2">
      <div class="avatar-ring">
        {#if photoUrl}
          <img class="avatar" src={photoUrl} alt={displayName || 'Profile'} />
        {:else}
          <div class="avatar avatar-fallback">
            <span>{avatarInitial}</span>
          </div>
        {/if}
      </div>
    </div>

    <!-- Display name -->
    {#if displayName}
      <p class="name anim anim-3">{displayName}</p>
    {/if}

    <!-- Vibe pills -->
    {#if displayedTags.length > 0}
      <div class="pills anim anim-4">
        {#each displayedTags as tag, i}
          <span class="pill" class:pill--red={i % 3 === 0} class:pill--blue={i % 3 === 1} class:pill--gold={i % 3 === 2}>{tag}</span>
        {/each}
      </div>
    {/if}

    <!-- City + date -->
    {#if cityDate}
      <p class="meta anim anim-5">{cityDate}</p>
    {/if}
  {/if}
</section>

<style>
  .hero {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    min-height: 65vh;
    padding-top: max(16px, env(safe-area-inset-top));
    padding-left: 24px;
    padding-right: 24px;
    padding-bottom: 24px;
  }

  /* ---------- Action buttons ---------- */
  .actions {
    position: absolute;
    top: max(16px, env(safe-area-inset-top));
    right: 16px;
    display: flex;
    gap: 4px;
    z-index: 10;
  }

  /* Push below the fixed mobile top bar (52px) */
  @media (max-width: 767px) {
    .actions {
      top: 60px;
    }
  }

  .action-btn {
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    font-size: 10px;
    font-weight: 500;
    color: var(--text-muted, rgba(255, 255, 255, 0.45));
    background: transparent;
    border: 1px solid rgba(255, 255, 255, 0.08);
    padding: 4px 10px;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 4px;
    transition: background 0.2s, color 0.2s;
    line-height: 1;
  }

  .action-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
  }

  .icon-btn {
    padding: 4px 6px;
  }

  .spinning :global(svg) {
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  /* ---------- Greeting ---------- */
  .greeting {
    font-size: 14px;
    font-weight: 500;
    color: var(--text-muted);
    letter-spacing: 0.01em;
    margin: 0 0 8px;
  }

  /* ---------- Kicker ---------- */
  .kicker {
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--text-muted, rgba(255, 255, 255, 0.45));
    margin: 0 0 12px;
  }

  /* ---------- Headline ---------- */
  .headline {
    font-family: var(--font-display, 'Bodoni Moda', serif);
    font-style: italic;
    font-weight: 400;
    font-size: clamp(1.75rem, 6vw, 3rem);
    letter-spacing: -0.02em;
    line-height: 1.15;
    color: var(--text-primary, #fff);
    text-wrap: balance;
    margin: 0 0 28px;
    max-width: 640px;
  }

  /* ---------- Avatar ---------- */
  .avatar-wrap {
    margin-bottom: 14px;
  }

  .avatar-ring {
    padding: 3px;
    border-radius: 50%;
    background: linear-gradient(135deg, #FF4D4D, #4D7CFF, #FFB84D);
    display: inline-block;
  }

  .avatar-ring .avatar {
    border: 3px solid var(--bg-primary, #0f1118);
  }

  .avatar {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    border: 2px solid rgba(255, 255, 255, 0.4);
    box-shadow:
      0 0 0 6px oklch(75% 0.22 130 / 0.12),
      0 12px 40px oklch(8% 0.008 260 / 0.5);
    object-fit: cover;
    display: block;
  }

  .avatar-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    background: oklch(75% 0.22 130 / 0.15);
  }

  .avatar-fallback span {
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    font-size: 32px;
    font-weight: 700;
    color: var(--accent-primary, #FF4D4D);
    line-height: 1;
  }

  @media (min-width: 640px) {
    .avatar {
      width: 108px;
      height: 108px;
    }

    .avatar-fallback span {
      font-size: 40px;
    }
  }

  /* ---------- Contradiction ---------- */
  .contradiction {
    font-size: 15px;
    color: var(--text-secondary);
    line-height: 1.6;
    max-width: min(24rem, 100%);
    text-align: center;
    margin: 0 0 20px;
    opacity: 0;
    animation: fadeSlideUp 0.5s ease 0.35s forwards;
  }

  /* ---------- Name ---------- */
  .name {
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-secondary, rgba(255, 255, 255, 0.7));
    letter-spacing: -0.01em;
    margin: 0 0 12px;
  }

  /* ---------- Vibe pills ---------- */
  .pills {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-bottom: 16px;
  }

  .pill {
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    font-size: 11px;
    font-weight: 500;
    padding: 5px 14px;
    border-radius: 100px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    color: var(--text-secondary);
    white-space: nowrap;
  }

  .pill--red { background: rgba(255,77,77,0.12); color: #FF6B6B; border-color: rgba(255,77,77,0.25); }
  .pill--blue { background: rgba(77,124,255,0.12); color: #6B9AFF; border-color: rgba(77,124,255,0.25); }
  .pill--gold { background: rgba(255,184,77,0.12); color: #FFC46B; border-color: rgba(255,184,77,0.25); }

  /* ---------- City + date ---------- */
  .meta {
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    font-size: 11px;
    font-weight: 400;
    color: var(--text-muted, rgba(255, 255, 255, 0.45));
    margin: 0;
  }

  /* ---------- Entrance animation ---------- */
  .anim {
    opacity: 0;
    transform: translateY(16px);
  }

  .mounted .anim {
    animation: fadeUp 500ms var(--ease-entrance, cubic-bezier(0.16, 1, 0.3, 1)) forwards;
  }

  .mounted .anim-0 { animation-delay: 0ms; }
  .mounted .anim-1 { animation-delay: 80ms; }
  .mounted .anim-1b { animation-delay: 120ms; }
  .mounted .anim-2 { animation-delay: 160ms; }
  .mounted .anim-3 { animation-delay: 240ms; }
  .mounted .anim-4 { animation-delay: 320ms; }
  .mounted .anim-5 { animation-delay: 400ms; }

  @keyframes fadeUp {
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes fadeSlideUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .anim {
      opacity: 1;
      transform: none;
    }

    .mounted .anim {
      animation: none;
    }

    .spinning :global(svg) {
      animation: none;
    }
  }

  /* ---------- Loading skeleton ---------- */
  .skeleton-wrap {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
  }

  .skel {
    background: var(--bg-elevated, rgba(255, 255, 255, 0.06));
    border-radius: 6px;
    animation: shimmer 1.6s ease-in-out infinite;
  }

  .skel-kicker {
    width: 140px;
    height: 12px;
    border-radius: 4px;
  }

  .skel-headline {
    width: 320px;
    max-width: 80%;
    height: 28px;
    border-radius: 6px;
  }

  .skel-headline.short {
    width: 200px;
    max-width: 55%;
  }

  .skel-avatar {
    width: 88px;
    height: 88px;
    border-radius: 50%;
    margin-top: 14px;
  }

  .skel-name {
    width: 100px;
    height: 14px;
    border-radius: 4px;
  }

  .skel-pills {
    display: flex;
    gap: 8px;
  }

  .skel-pill {
    width: 64px;
    height: 26px;
    border-radius: 100px;
  }

  @keyframes shimmer {
    0% { opacity: 0.35; }
    50% { opacity: 0.75; }
    100% { opacity: 0.35; }
  }
</style>
