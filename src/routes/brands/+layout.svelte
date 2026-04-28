<script lang="ts">
  import { page } from '$app/stores';
  import OsPageShell from '$lib/components/os/OsPageShell.svelte';
  import { themeMode, toggleThemeMode, syncThemeColor } from '$lib/stores/theme';

  export let data: {
    brandAuthenticated: boolean;
    brandAccount: { ig_username: string; ig_name: string; ig_profile_picture: string } | null;
    sessionOutOfSync: boolean;
  };

  $: pathname = $page.url.pathname;
  $: onPortal = pathname.startsWith('/brands/portal');
  $: onCreators = pathname.startsWith('/brands/creators');
  $: onLogin = pathname.startsWith('/brands/login');
  $: authed = data.brandAuthenticated;
  $: brand = data.brandAccount;

  const sections = [
    { num: '01', label: 'Content Studio', href: '/brands/portal?tab=content' },
    { num: '02', label: 'Find Creators', href: '/brands/creators' },
    { num: '03', label: 'Content Automation', href: '/brands/portal?tab=automation' },
    { num: '04', label: 'Profile & Insights', href: '/brands/portal?tab=profile' },
  ] as const;

  $: portalTabParam = $page.url.searchParams.get('tab');
  $: activeSection = onCreators ? '02' : onPortal ? (portalTabParam === 'automation' ? '03' : portalTabParam === 'profile' ? '04' : '01') : null;

  const now = new Date();
  const monthNames = [
    'JAN',
    'FEB',
    'MAR',
    'APR',
    'MAY',
    'JUN',
    'JUL',
    'AUG',
    'SEP',
    'OCT',
    'NOV',
    'DEC',
  ];
  const issueDate = `${monthNames[now.getMonth()]} ${now.getFullYear()}`;
  const issueVol = `VOL.01`;

  let mobileMenuOpen = false;

  // Theme toggle: use global app mode so creator + brand share one source.
  $: deepMode = $themeMode === 'dark';
  $: syncThemeColor($themeMode);

  function toggleTheme() {
    toggleThemeMode();
  }

  async function handleSignOut() {
    await fetch('/api/brands/logout', { method: 'POST' });
    window.location.href = '/brands/login';
  }
</script>

<!-- ═══ Brand OS Shell ═══ -->
<div class="bos-shell">

  <!-- ── Top Bar ── -->
  <header class="bos-topbar">
    <div class="bos-topbar__left">
      {#if brand}
        <div class="bos-avatar">
          {#if brand.ig_profile_picture}
            <img src={brand.ig_profile_picture} alt={brand.ig_name} />
          {:else}
            <span class="bos-avatar__initials">
              {brand.ig_name?.charAt(0)?.toUpperCase() || 'B'}
            </span>
          {/if}
        </div>
        <div class="bos-identity">
          <span class="bos-identity__name">{brand.ig_name}</span>
          <span class="bos-identity__handle">@{brand.ig_username}</span>
        </div>
      {:else}
        <div class="bos-avatar">
          <span class="bos-avatar__initials">B</span>
        </div>
        <div class="bos-identity">
          <span class="bos-identity__name">Brand OS</span>
          <span class="bos-identity__handle">{issueDate} &middot; {issueVol}</span>
        </div>
      {/if}
    </div>

    <!-- Center: Nav pills -->
    <nav class="bos-topbar__nav">
      {#each sections as sec}
        <a
          href={sec.href}
          class="bos-pill"
          class:bos-pill--active={activeSection === sec.num}
        >
          <span class="bos-pill__num">{sec.num}</span>
          <span class="bos-pill__label">{sec.label}</span>
        </a>
      {/each}
    </nav>

    <!-- Right: Actions -->
    <div class="bos-topbar__right">
      {#if authed}
        <button class="bos-icon-btn" on:click={toggleTheme} title="Toggle theme">
          {#if deepMode}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="5"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.72 12.72 1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
          {/if}
        </button>
        <button class="bos-sign-out" on:click={handleSignOut}>
          <span class="bos-sign-out__label">Sign Out</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4m7 14 5-5-5-5m5 5H9"/></svg>
        </button>
      {:else if !onLogin}
        <a href="/brands/login" class="bos-connect-cta">
          <span>Connect Instagram</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M5 12h14m-7-7 7 7-7 7"/></svg>
        </a>
      {/if}

      <!-- Mobile hamburger -->
      <button
        class="bos-hamburger"
        on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
        aria-label="Toggle menu"
      >
        <span class="bos-hamburger__line" class:open={mobileMenuOpen}></span>
        <span class="bos-hamburger__line" class:open={mobileMenuOpen}></span>
      </button>
    </div>
  </header>

  <!-- ── Session out-of-sync banner ── -->
  {#if data.sessionOutOfSync}
    <div class="bos-sync-banner">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E8833A" stroke-width="2"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>Session out of sync. Please <a href="/brands/login">re-authenticate</a> to refresh your data.</span>
    </div>
  {/if}

  <!-- ── Main content area ── -->
  <main class="bos-main">
    <OsPageShell as="div" className={onPortal ? 'os-shell-bypass' : ''}>
      <slot />
    </OsPageShell>
  </main>

  <!-- ── Mobile overlay nav ── -->
  {#if mobileMenuOpen}
    <div class="bos-mobile-overlay" on:click={() => (mobileMenuOpen = false)} on:keydown={() => {}}>
      <nav class="bos-mobile-nav" on:click|stopPropagation on:keydown|stopPropagation>
        <div class="bos-mobile-nav__header">
          <span class="bos-mono-label">NAVIGATION</span>
          <button class="bos-icon-btn" on:click={() => (mobileMenuOpen = false)} aria-label="Close menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 6 6 18M6 6l12 12"/></svg>
          </button>
        </div>
        {#each sections as sec}
          <a
            href={sec.href}
            class="bos-mobile-link"
            class:bos-mobile-link--active={activeSection === sec.num}
            on:click={() => (mobileMenuOpen = false)}
          >
            <span class="bos-mobile-link__num">{sec.num}</span>
            <span class="bos-mobile-link__label">{sec.label}</span>
          </a>
        {/each}
        {#if authed}
          <div class="bos-mobile-nav__footer">
            <button class="bos-mobile-signout" on:click={handleSignOut}>Sign Out</button>
          </div>
        {/if}
      </nav>
    </div>
  {/if}
</div>

<style>
  /* ═══════════════════════════════════════════
     Brand OS Shell — Dark Surface Design
     ═══════════════════════════════════════════ */

  :root {
    --bos-bg: #0A0A0C;
    --bos-surface: rgba(255, 255, 255, 0.02);
    --bos-border: rgba(255, 255, 255, 0.06);
    --bos-text: #EDEDEF;
    --bos-text-secondary: #4A4A50;
    --bos-text-muted: #3A3A40;
    --bos-accent: #E8833A;
    --bos-font: 'Geist Variable', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
    --bos-mono: 'Geist Mono Variable', 'SF Mono', 'Fira Code', monospace;
  }

  /* ── Shell ── */
  .bos-shell {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-height: 100vh;
    min-height: 100dvh;
    background: var(--bos-bg);
    color: var(--bos-text);
    font-family: var(--bos-font);
    overflow: visible;
  }

  /* ── Top Bar ── */
  .bos-topbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: 0 24px;
    height: 56px;
    min-height: 56px;
    background: var(--bos-surface);
    border-bottom: 1px solid var(--bos-border);
    position: relative;
    z-index: 100;
  }

  .bos-topbar__left {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .bos-topbar__right {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
  }

  /* ── Avatar ── */
  .bos-avatar {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.06);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .bos-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .bos-avatar__initials {
    font-family: var(--bos-mono);
    font-size: 13px;
    font-weight: 500;
    color: var(--bos-accent);
  }

  /* ── Identity ── */
  .bos-identity {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .bos-identity__name {
    font-size: 13px;
    font-weight: 500;
    color: var(--bos-text);
    line-height: 1.2;
  }

  .bos-identity__handle {
    font-family: var(--bos-mono);
    font-size: 10px;
    color: var(--bos-text-secondary);
    letter-spacing: 0.02em;
    line-height: 1.2;
  }

  /* ── Nav Pills ── */
  .bos-topbar__nav {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .bos-pill {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 6px;
    text-decoration: none;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .bos-pill__num {
    font-family: var(--bos-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bos-text-muted);
    transition: color 0.15s ease;
  }

  .bos-pill__label {
    font-family: var(--bos-mono);
    font-size: 11px;
    letter-spacing: 0.04em;
    color: var(--bos-text-secondary);
    transition: color 0.15s ease;
  }

  .bos-pill:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .bos-pill:hover .bos-pill__label {
    color: var(--bos-text);
  }

  .bos-pill--active {
    background: rgba(232, 131, 58, 0.08);
  }

  .bos-pill--active .bos-pill__num {
    color: var(--bos-accent);
  }

  .bos-pill--active .bos-pill__label {
    color: var(--bos-text);
  }

  /* ── Action Buttons ── */
  .bos-icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--bos-text-secondary);
    cursor: pointer;
    transition: background 0.15s ease, color 0.15s ease;
  }

  .bos-icon-btn:hover {
    background: rgba(255, 255, 255, 0.06);
    color: var(--bos-text);
  }

  .bos-sign-out {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    border: 1px solid var(--bos-border);
    border-radius: 6px;
    background: transparent;
    color: var(--bos-text-secondary);
    cursor: pointer;
    font-family: var(--bos-mono);
    font-size: 10px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    transition: all 0.15s ease;
  }

  .bos-sign-out:hover {
    border-color: rgba(255, 255, 255, 0.12);
    color: var(--bos-text);
    background: rgba(255, 255, 255, 0.03);
  }

  .bos-sign-out__label {
    display: inline;
  }

  .bos-connect-cta {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 6px;
    background: var(--bos-accent);
    color: #0A0A0C;
    text-decoration: none;
    font-family: var(--bos-mono);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    transition: opacity 0.15s ease;
  }

  .bos-connect-cta:hover {
    opacity: 0.88;
  }

  /* ── Sync Banner ── */
  .bos-sync-banner {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 24px;
    background: rgba(232, 131, 58, 0.06);
    border-bottom: 1px solid rgba(232, 131, 58, 0.12);
    font-family: var(--bos-mono);
    font-size: 12px;
    color: var(--bos-text-secondary);
  }

  .bos-sync-banner a {
    color: var(--bos-accent);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* ── Main Content ── */
  .bos-main {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    overflow-x: clip;
  }

  /* ── Mobile Hamburger ── */
  .bos-hamburger {
    display: none;
    flex-direction: column;
    gap: 5px;
    padding: 8px;
    border: none;
    background: transparent;
    cursor: pointer;
  }

  .bos-hamburger__line {
    display: block;
    width: 18px;
    height: 1.5px;
    background: var(--bos-text-secondary);
    border-radius: 1px;
    transition: transform 0.2s ease, opacity 0.2s ease;
  }

  .bos-hamburger__line.open:first-child {
    transform: rotate(45deg) translate(2px, 2px);
  }

  .bos-hamburger__line.open:last-child {
    transform: rotate(-45deg) translate(2px, -2px);
  }

  /* ── Mobile Overlay ── */
  .bos-mobile-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
  }

  .bos-mobile-nav {
    position: absolute;
    top: 0;
    right: 0;
    width: 280px;
    height: 100%;
    background: #111114;
    border-left: 1px solid var(--bos-border);
    display: flex;
    flex-direction: column;
    padding: 20px;
  }

  .bos-mobile-nav__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid var(--bos-border);
  }

  .bos-mono-label {
    font-family: var(--bos-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--bos-text-muted);
  }

  .bos-mobile-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 8px;
    border-radius: 6px;
    text-decoration: none;
    transition: background 0.15s ease;
  }

  .bos-mobile-link:hover {
    background: rgba(255, 255, 255, 0.04);
  }

  .bos-mobile-link__num {
    font-family: var(--bos-mono);
    font-size: 10px;
    color: var(--bos-text-muted);
    letter-spacing: 0.1em;
  }

  .bos-mobile-link__label {
    font-family: var(--bos-mono);
    font-size: 13px;
    color: var(--bos-text-secondary);
  }

  .bos-mobile-link--active .bos-mobile-link__num {
    color: var(--bos-accent);
  }

  .bos-mobile-link--active .bos-mobile-link__label {
    color: var(--bos-text);
  }

  .bos-mobile-nav__footer {
    margin-top: auto;
    padding-top: 16px;
    border-top: 1px solid var(--bos-border);
  }

  .bos-mobile-signout {
    width: 100%;
    padding: 10px;
    border: 1px solid var(--bos-border);
    border-radius: 6px;
    background: transparent;
    color: var(--bos-text-secondary);
    font-family: var(--bos-mono);
    font-size: 11px;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .bos-mobile-signout:hover {
    border-color: rgba(255, 255, 255, 0.12);
    color: var(--bos-text);
  }

  /* ── Responsive ── */
  @media (max-width: 768px) {
    .bos-topbar {
      grid-template-columns: 1fr auto;
      padding: 0 16px;
    }

    .bos-topbar__nav {
      display: none;
    }

    .bos-hamburger {
      display: flex;
    }

    .bos-sign-out {
      display: none;
    }

    .bos-identity__name {
      font-size: 12px;
    }

    .bos-identity__handle {
      font-size: 9px;
    }
  }

  @media (max-width: 480px) {
    .bos-topbar {
      height: 48px;
      min-height: 48px;
      padding: 0 12px;
    }

    .bos-avatar {
      width: 28px;
      height: 28px;
      border-radius: 6px;
    }

    .bos-connect-cta span {
      display: none;
    }
  }
</style>
