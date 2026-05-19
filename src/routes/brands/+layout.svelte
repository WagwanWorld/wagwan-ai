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
    { num: '02', label: 'Briefs', href: '/brands/briefs' },
    { num: '03', label: 'Find Creators', href: '/brands/creators' },
    { num: '04', label: 'Content Automation', href: '/brands/portal?tab=automation' },
    { num: '05', label: 'Profile & Insights', href: '/brands/portal?tab=profile' },
  ] as const;

  $: portalTabParam = $page.url.searchParams.get('tab');
  $: onBriefs = pathname.startsWith('/brands/briefs');
  $: activeSection = onBriefs
    ? '02'
    : onCreators
      ? '03'
      : onPortal
        ? portalTabParam === 'automation'
          ? '04'
          : portalTabParam === 'profile'
            ? '05'
            : '01'
        : null;

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
    window.location.href = '/';
  }
</script>

<!-- ═══ Brand OS Shell — Sidebar Layout ═══ -->
<div class="bos-shell">
  <!-- ── Left Sidebar ── -->
  <aside class="bos-sidebar">
    <div class="bos-sidebar-brand">
      <img src="/wagwan-logo-white.svg" alt="Wagwan" class="bos-sidebar-logo" />
    </div>

    {#if brand}
      <div class="bos-sidebar-profile">
        <div class="bos-sidebar-avatar">
          {#if brand.ig_profile_picture}
            <img src={brand.ig_profile_picture} alt={brand.ig_name} />
          {:else}
            <span>{brand.ig_name?.charAt(0)?.toUpperCase() || 'B'}</span>
          {/if}
        </div>
        <span class="bos-sidebar-name">{brand.ig_name}</span>
        <span class="bos-sidebar-handle">@{brand.ig_username}</span>
      </div>
    {/if}

    <nav class="bos-sidebar-nav">
      {#each sections as sec}
        <a
          href={sec.href}
          class="bos-sidebar-link"
          class:bos-sidebar-link--active={activeSection === sec.num}
        >
          {sec.label}
        </a>
      {/each}
    </nav>

    <div class="bos-sidebar-footer">
      {#if authed}
        <button class="bos-sidebar-signout" on:click={handleSignOut}>Sign Out</button>
      {:else if !onLogin}
        <a href="/" class="bos-sidebar-signout">Connect Instagram</a>
      {/if}

      <div class="bos-footer-info">
        <img src="/wagwan-logo-white.svg" alt="Wagwan" class="bos-footer-logo" />
        <a href="mailto:madhvik@wagwanworld.in" class="bos-footer-link">madhvik@wagwanworld.in</a>
        <div class="bos-footer-socials">
          <a
            href="https://instagram.com/wagwan.world"
            target="_blank"
            rel="noopener"
            class="bos-footer-social">Instagram</a
          >
          <a
            href="https://linkedin.com/company/wagwan-world"
            target="_blank"
            rel="noopener"
            class="bos-footer-social">LinkedIn</a
          >
        </div>
      </div>
    </div>
  </aside>

  <!-- ── Mobile top bar ── -->
  <header class="bos-mobile-bar">
    <img src="/wagwan-logo-white.svg" alt="Wagwan" class="bos-mobile-logo" />
    <button
      class="bos-hamburger"
      on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
      aria-label="Toggle menu"
    >
      <span class="bos-hamburger__line" class:open={mobileMenuOpen}></span>
      <span class="bos-hamburger__line" class:open={mobileMenuOpen}></span>
    </button>
  </header>

  <!-- ── Session out-of-sync banner ── -->
  {#if data.sessionOutOfSync}
    <div class="bos-sync-banner">
      <span>Session out of sync. <a href="/">Re-authenticate</a>.</span>
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
        {#each sections as sec}
          <a
            href={sec.href}
            class="bos-mobile-link"
            class:bos-mobile-link--active={activeSection === sec.num}
            on:click={() => (mobileMenuOpen = false)}
          >
            {sec.label}
          </a>
        {/each}
        {#if authed}
          <button class="bos-mobile-signout" on:click={handleSignOut}>Sign Out</button>
        {/if}
      </nav>
    </div>
  {/if}
</div>

<style>
  .bos-shell {
    display: flex;
    min-height: 100vh;
    color: #ededef;
    font-family:
      'Geist Variable',
      'Inter',
      -apple-system,
      sans-serif;
    background:
      radial-gradient(circle at 72% 18%, rgba(153, 36, 96, 0.34), transparent 42%),
      radial-gradient(circle at 30% 78%, rgba(196, 242, 74, 0.12), transparent 32%),
      linear-gradient(145deg, #030306 0%, #0b0710 48%, #1b0817 100%);
    background-attachment: fixed;
  }

  /* ── Sidebar ── */
  .bos-sidebar {
    display: none;
    flex-direction: column;
    width: 200px;
    flex-shrink: 0;
    padding: 24px 16px 20px;
    border-right: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(3, 3, 6, 0.6);
    backdrop-filter: blur(12px);
  }

  @media (min-width: 768px) {
    .bos-sidebar {
      display: flex;
    }
    .bos-mobile-bar {
      display: none !important;
    }
  }

  @media (min-width: 768px) and (max-width: 1023px) {
    .bos-sidebar {
      width: 60px;
      padding: 20px 8px 16px;
      align-items: center;
    }
    .bos-sidebar-logo {
      display: none;
    }
    .bos-sidebar-name,
    .bos-sidebar-handle {
      display: none;
    }
    .bos-sidebar-link {
      font-size: 10px;
      padding: 8px;
      justify-content: center;
      text-align: center;
    }
    .bos-footer-info {
      display: none;
    }
  }

  .bos-sidebar-brand {
    margin-bottom: 28px;
  }

  .bos-sidebar-logo {
    height: 14px;
    width: auto;
    opacity: 0.5;
  }

  .bos-sidebar-profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  }

  .bos-sidebar-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    border: 2px solid rgba(196, 242, 74, 0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(196, 242, 74, 0.1);
    color: #c4f24a;
    font-weight: 700;
    font-size: 16px;
  }
  .bos-sidebar-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .bos-sidebar-name {
    font-size: 13px;
    font-weight: 600;
    text-align: center;
  }

  .bos-sidebar-handle {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    color: rgba(255, 248, 232, 0.4);
  }

  .bos-sidebar-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
  }

  .bos-sidebar-link {
    display: flex;
    align-items: center;
    padding: 9px 12px;
    border-radius: 10px;
    text-decoration: none;
    color: rgba(255, 248, 232, 0.5);
    font-size: 13px;
    font-weight: 500;
    border: 1px solid transparent;
    transition:
      color 150ms ease,
      background 150ms ease;
  }
  .bos-sidebar-link:hover {
    color: rgba(255, 248, 232, 0.8);
    background: rgba(255, 255, 255, 0.03);
  }
  .bos-sidebar-link--active {
    color: #c4f24a;
    background: rgba(196, 242, 74, 0.08);
    border-color: rgba(196, 242, 74, 0.14);
  }

  .bos-sidebar-footer {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .bos-sidebar-signout {
    display: block;
    width: 100%;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: transparent;
    color: rgba(255, 248, 232, 0.5);
    font-size: 12px;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    text-decoration: none;
    text-align: center;
    transition:
      color 150ms ease,
      border-color 150ms ease;
  }
  .bos-sidebar-signout:hover {
    color: #ff4d97;
    border-color: rgba(255, 77, 151, 0.2);
  }

  /* ── Footer ── */
  .bos-footer-info {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding-top: 16px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
  }

  .bos-footer-logo {
    height: 12px;
    width: auto;
    opacity: 0.3;
  }

  .bos-footer-link {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    color: rgba(255, 248, 232, 0.3);
    text-decoration: none;
    letter-spacing: 0.02em;
  }
  .bos-footer-link:hover {
    color: rgba(255, 248, 232, 0.6);
  }

  .bos-footer-socials {
    display: flex;
    gap: 10px;
  }
  .bos-footer-social {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    color: rgba(255, 248, 232, 0.25);
    text-decoration: none;
    letter-spacing: 0.02em;
  }
  .bos-footer-social:hover {
    color: #c4f24a;
  }

  /* ── Mobile bar ── */
  .bos-mobile-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    position: sticky;
    top: 0;
    z-index: 50;
    background: rgba(3, 3, 6, 0.8);
    backdrop-filter: blur(12px);
  }

  .bos-mobile-logo {
    height: 14px;
    width: auto;
    opacity: 0.7;
  }

  .bos-hamburger {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px;
    border: none;
    background: none;
    cursor: pointer;
  }
  .bos-hamburger__line {
    width: 18px;
    height: 1.5px;
    background: rgba(255, 248, 232, 0.6);
    border-radius: 1px;
    transition:
      transform 200ms ease,
      opacity 200ms ease;
  }
  .bos-hamburger__line.open:first-child {
    transform: rotate(45deg) translate(2px, 2px);
  }
  .bos-hamburger__line.open:last-child {
    transform: rotate(-45deg) translate(2px, -2px);
  }

  /* ── Sync banner ── */
  .bos-sync-banner {
    padding: 8px 16px;
    background: rgba(255, 77, 151, 0.06);
    border-bottom: 1px solid rgba(255, 77, 151, 0.1);
    font-size: 12px;
    color: #ff4d97;
    text-align: center;
  }
  .bos-sync-banner a {
    color: #c4f24a;
    text-decoration: underline;
  }

  /* ── Main ── */
  .bos-main {
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    overflow-x: hidden;
  }

  /* ── Mobile overlay ── */
  .bos-mobile-overlay {
    position: fixed;
    inset: 0;
    z-index: 100;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
  }

  .bos-mobile-nav {
    position: absolute;
    top: 0;
    right: 0;
    width: min(280px, 80vw);
    height: 100%;
    background: rgba(10, 10, 14, 0.95);
    border-left: 1px solid rgba(255, 255, 255, 0.06);
    padding: 24px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    backdrop-filter: blur(20px);
  }

  .bos-mobile-link {
    display: block;
    padding: 12px 14px;
    border-radius: 10px;
    text-decoration: none;
    color: rgba(255, 248, 232, 0.6);
    font-size: 14px;
    font-weight: 500;
    transition:
      color 150ms ease,
      background 150ms ease;
  }
  .bos-mobile-link:hover {
    background: rgba(255, 255, 255, 0.03);
  }
  .bos-mobile-link--active {
    color: #c4f24a;
    background: rgba(196, 242, 74, 0.08);
  }

  .bos-mobile-signout {
    margin-top: auto;
    padding: 12px 14px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 10px;
    background: none;
    color: rgba(255, 248, 232, 0.5);
    font-size: 13px;
    cursor: pointer;
    font-family: inherit;
  }

  @media (max-width: 767px) {
    .bos-sidebar {
      display: none;
    }
  }
</style>
