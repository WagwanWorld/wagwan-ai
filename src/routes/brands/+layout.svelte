<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

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
    { num: '03', label: 'Profile & Insights', href: '/brands/portal?tab=profile' },
  ] as const;

  $: activeSection = onCreators ? '02' : onPortal ? '01' : null;

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

  // Theme toggle: dim (default, softer) vs deep (brighter, higher contrast)
  let deepMode = false;
  if (browser) {
    deepMode = localStorage.getItem('ed-theme') === 'deep';
  }

  function toggleTheme() {
    deepMode = !deepMode;
    if (browser) {
      localStorage.setItem('ed-theme', deepMode ? 'deep' : 'dim');
    }
  }

  async function handleSignOut() {
    await fetch('/api/brands/logout', { method: 'POST' });
    window.location.href = '/brands/login';
  }
</script>

<div class="glass-shell" data-glass-theme={deepMode ? 'deep' : 'dim'}>
  <!-- Ambient gradient orbs -->
  <div class="ambient-orb orb-red" aria-hidden="true"></div>
  <div class="ambient-orb orb-blue" aria-hidden="true"></div>
  <div class="ambient-orb orb-gold" aria-hidden="true"></div>
  <div class="ambient-orb orb-purple" aria-hidden="true"></div>

  <!-- Top bar -->
  <header class="topbar">
    <div class="topbar-inner">
      <!-- Left: brand avatar + name -->
      <div class="topbar-left">
        <a href="/brands" class="brand-mark" aria-label="Wagwan Home">
          <img src="/logo-white.svg" alt="WagwanAI" class="brand-logo" />
        </a>
        <div class="topbar-divider"></div>
        <span class="brand-label">Brands</span>
      </div>

      <!-- Center: section switcher as glass pills -->
      {#if authed && !onLogin}
        <nav class="pill-switcher desktop-only" aria-label="Main sections">
          {#each sections as section}
            <a href={section.href} class="pill-tab" class:active={activeSection === section.num}>
              {section.label}
            </a>
          {/each}
        </nav>
      {/if}

      <!-- Right: actions -->
      <div class="topbar-right">
        <!-- Dark mode toggle -->
        <button
          class="theme-toggle"
          on:click={toggleTheme}
          aria-label="Toggle theme"
          title={deepMode ? 'Dim mode' : 'Deep mode'}
        >
          {#if deepMode}
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
              ><circle cx="7.5" cy="7.5" r="3.5" stroke="currentColor" stroke-width="1.2" /><path
                d="M7.5 1v2M7.5 12v2M1 7.5h2M12 7.5h2M3.05 3.05l1.4 1.4M10.55 10.55l1.4 1.4M11.95 3.05l-1.4 1.4M4.45 10.55l-1.4 1.4"
                stroke="currentColor"
                stroke-width="1"
                stroke-linecap="round"
              /></svg
            >
          {:else}
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"
              ><path
                d="M13 9a5.5 5.5 0 1 1-7-7 4.5 4.5 0 0 0 7 7z"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
            >
          {/if}
        </button>

        {#if authed && brand}
          <!-- Signed in: account pill -->
          <div class="account-pill">
            {#if brand.ig_profile_picture}
              <img src={brand.ig_profile_picture} alt="" class="account-avatar" />
            {:else}
              <div class="account-avatar account-avatar--fallback">
                {(brand.ig_name || 'B').charAt(0)}
              </div>
            {/if}
            <span class="account-handle">@{brand.ig_username}</span>
            <button class="sign-out-btn" on:click={handleSignOut} title="Sign out">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"
                ><path
                  d="M4.5 10.5H2.5a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1h2M8 8.5l2.5-2.5L8 3.5M10.5 6H4.5"
                  stroke="currentColor"
                  stroke-width="1"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                /></svg
              >
            </button>
          </div>
        {:else if authed && data.sessionOutOfSync && !onLogin}
          <!-- Valid cookie but brand_accounts row missing: prompt reconnect -->
          <a href="/brands/login" class="connect-cta connect-cta--resync">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"
              ><path
                d="M2 7a5 5 0 1 1 5 5"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
              /><path
                d="M12 2v3h-3"
                stroke="currentColor"
                stroke-width="1.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              /></svg
            >
            Reconnect Instagram
          </a>
        {:else if !onLogin}
          <!-- Signed out: Connect CTA -->
          <a href="/brands/login" class="connect-cta">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
              ><rect
                x="1"
                y="1"
                width="12"
                height="12"
                rx="3"
                stroke="currentColor"
                stroke-width="1"
              /><circle cx="7" cy="5.5" r="1.5" stroke="currentColor" stroke-width="0.8" /><path
                d="M4 10.5c0-1.66 1.34-3 3-3s3 1.34 3 3"
                stroke="currentColor"
                stroke-width="0.8"
                stroke-linecap="round"
              /></svg
            >
            Connect Instagram
          </a>
        {/if}

        <!-- Mobile hamburger -->
        <button
          class="mobile-toggle desktop-hidden"
          on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          {#if mobileMenuOpen}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 3l10 10M13 3L3 13"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          {:else}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M1 4h14M1 8h14M1 12h14"
                stroke="currentColor"
                stroke-width="1.5"
                stroke-linecap="round"
              />
            </svg>
          {/if}
        </button>
      </div>
    </div>

    <!-- Mobile nav overlay -->
    {#if mobileMenuOpen}
      <nav class="mobile-overlay desktop-hidden">
        {#if authed}
          {#each sections as section}
            <a
              href={section.href}
              class="mobile-link"
              class:active={activeSection === section.num}
              on:click={() => (mobileMenuOpen = false)}
            >
              {section.label}
            </a>
          {/each}
        {/if}
        <div class="mobile-divider"></div>
        <a href="/" class="mobile-link" on:click={() => (mobileMenuOpen = false)}>Creator App</a>
        {#if authed}
          <button
            class="mobile-link mobile-link--signout"
            on:click={() => {
              mobileMenuOpen = false;
              handleSignOut();
            }}
          >
            Sign out
          </button>
        {/if}
      </nav>
    {/if}
  </header>

  <!-- Main content area -->
  <main class="glass-main">
    {#if authed && data.sessionOutOfSync && !onLogin}
      <div class="resync-banner" role="status">
        <span class="resync-banner__dot"></span>
        <div class="resync-banner__body">
          <strong>Session out of sync.</strong>
          <span
            >We couldn't find your Instagram brand account. Reconnect to restore campaign tools.</span
          >
        </div>
        <a href="/brands/login" class="resync-banner__btn">Reconnect</a>
      </div>
    {/if}
    <slot />
  </main>
</div>

<style>
  /* ================================================================
     AMBIENT GRADIENT ORBS
     ================================================================ */
  .ambient-orb {
    position: fixed;
    pointer-events: none;
    z-index: 0;
    border-radius: 50%;
    filter: blur(110px);
    will-change: transform, border-radius;
  }

  .orb-red {
    width: 600px;
    height: 600px;
    top: -10%;
    left: -5%;
    background: rgba(255, 45, 45, 0.05);
    animation: orb-morph-1 42s linear infinite;
  }

  .orb-blue {
    width: 550px;
    height: 550px;
    top: 30%;
    right: -8%;
    background: rgba(40, 80, 255, 0.04);
    animation: orb-morph-2 48s linear infinite;
  }

  .orb-gold {
    width: 500px;
    height: 500px;
    bottom: -5%;
    left: 20%;
    background: rgba(255, 150, 20, 0.035);
    animation: orb-morph-3 45s linear infinite;
  }

  .orb-purple {
    width: 480px;
    height: 480px;
    bottom: 15%;
    right: 15%;
    background: rgba(120, 60, 220, 0.025);
    animation: orb-morph-4 50s linear infinite;
  }

  @keyframes orb-morph-1 {
    0% {
      transform: translate(0, 0) scale(1);
      border-radius: 50% 40% 55% 45%;
    }
    25% {
      transform: translate(40px, 30px) scale(1.08);
      border-radius: 45% 55% 40% 50%;
    }
    50% {
      transform: translate(-20px, 60px) scale(0.95);
      border-radius: 55% 45% 50% 40%;
    }
    75% {
      transform: translate(30px, -20px) scale(1.05);
      border-radius: 40% 50% 45% 55%;
    }
    100% {
      transform: translate(0, 0) scale(1);
      border-radius: 50% 40% 55% 45%;
    }
  }

  @keyframes orb-morph-2 {
    0% {
      transform: translate(0, 0) scale(1);
      border-radius: 45% 55% 50% 40%;
    }
    25% {
      transform: translate(-35px, 45px) scale(1.06);
      border-radius: 50% 40% 45% 55%;
    }
    50% {
      transform: translate(25px, -30px) scale(0.97);
      border-radius: 40% 50% 55% 45%;
    }
    75% {
      transform: translate(-15px, -40px) scale(1.04);
      border-radius: 55% 45% 40% 50%;
    }
    100% {
      transform: translate(0, 0) scale(1);
      border-radius: 45% 55% 50% 40%;
    }
  }

  @keyframes orb-morph-3 {
    0% {
      transform: translate(0, 0) scale(1);
      border-radius: 55% 45% 40% 50%;
    }
    25% {
      transform: translate(30px, -35px) scale(0.96);
      border-radius: 40% 50% 55% 45%;
    }
    50% {
      transform: translate(-40px, 20px) scale(1.07);
      border-radius: 50% 40% 45% 55%;
    }
    75% {
      transform: translate(20px, 40px) scale(1.02);
      border-radius: 45% 55% 50% 40%;
    }
    100% {
      transform: translate(0, 0) scale(1);
      border-radius: 55% 45% 40% 50%;
    }
  }

  @keyframes orb-morph-4 {
    0% {
      transform: translate(0, 0) scale(1);
      border-radius: 40% 50% 55% 45%;
    }
    25% {
      transform: translate(-25px, -30px) scale(1.05);
      border-radius: 55% 45% 40% 50%;
    }
    50% {
      transform: translate(35px, 25px) scale(0.94);
      border-radius: 45% 55% 50% 40%;
    }
    75% {
      transform: translate(-20px, 35px) scale(1.03);
      border-radius: 50% 40% 55% 45%;
    }
    100% {
      transform: translate(0, 0) scale(1);
      border-radius: 40% 50% 55% 45%;
    }
  }

  /* ================================================================
     TOP BAR — glass panel with 3D treatment
     ================================================================ */
  .topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.04) 0%,
      rgba(255, 255, 255, 0.015) 100%
    );
    backdrop-filter: blur(32px);
    -webkit-backdrop-filter: blur(32px);
    border-bottom: 1px solid var(--g-card-border);
    box-shadow:
      inset 0 1px 0 0 rgba(255, 255, 255, 0.06),
      inset 0 -1px 0 0 rgba(0, 0, 0, 0.12),
      0 4px 24px rgba(0, 0, 0, 0.1),
      0 1px 3px rgba(0, 0, 0, 0.08);
  }

  .topbar-inner {
    max-width: 80rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    height: 56px;
  }

  /* ── Left: brand mark ── */
  .topbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .brand-mark {
    display: flex;
    align-items: center;
    text-decoration: none;
    transition: opacity var(--g-dur-fast) var(--g-ease);
  }
  .brand-mark:hover {
    opacity: 0.7;
  }

  .brand-logo {
    height: 18px;
    width: auto;
  }

  .topbar-divider {
    width: 1px;
    height: 20px;
    background: var(--g-card-border);
  }

  .brand-label {
    font-family: var(--g-font);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--g-text-3);
  }

  /* ================================================================
     PILL SWITCHER — glass pill tabs
     ================================================================ */
  .pill-switcher {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.02);
    border: 1px solid rgba(255, 255, 255, 0.03);
  }

  .pill-tab {
    position: relative;
    display: flex;
    align-items: center;
    padding: 6px 16px;
    border-radius: 10px;
    text-decoration: none;
    font-family: var(--g-font);
    font-size: 11px;
    font-weight: 550;
    letter-spacing: 0.03em;
    color: var(--g-text-3);
    background: transparent;
    border: 1px solid transparent;
    transition:
      color var(--g-dur-fast) var(--g-ease),
      background var(--g-dur-fast) var(--g-ease),
      border-color var(--g-dur-fast) var(--g-ease),
      box-shadow var(--g-dur-fast) var(--g-ease);
  }

  .pill-tab:hover {
    color: var(--g-text-2);
    background: rgba(255, 255, 255, 0.025);
  }

  .pill-tab.active {
    color: var(--g-text);
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.06);
    box-shadow:
      inset 0 1px 0 0 rgba(255, 255, 255, 0.04),
      0 1px 4px rgba(0, 0, 0, 0.08);
  }

  .pill-tab.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 20%;
    right: 20%;
    height: 2px;
    border-radius: 1px;
    background: var(--g-accent);
    opacity: 0.7;
  }

  /* ================================================================
     RIGHT ACTIONS
     ================================================================ */
  .topbar-right {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  /* Dark mode toggle — glass square */
  .theme-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 10px;
    border: 1px solid var(--g-card-border);
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    color: var(--g-text-3);
    cursor: pointer;
    transition:
      color var(--g-dur-fast) var(--g-ease),
      background var(--g-dur-fast) var(--g-ease),
      border-color var(--g-dur-fast) var(--g-ease);
  }
  .theme-toggle:hover {
    color: var(--g-text);
    background: rgba(255, 255, 255, 0.04);
    border-color: var(--g-card-border-hover);
  }

  /* Account pill (signed in) */
  .account-pill {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 10px 4px 4px;
    border-radius: 12px;
    border: 1px solid var(--g-card-border);
    background: rgba(255, 255, 255, 0.02);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.03);
  }

  .account-avatar {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    object-fit: cover;
    background: linear-gradient(135deg, var(--g-accent-soft), rgba(255, 255, 255, 0.03));
  }

  .account-avatar--fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--g-font);
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--g-text-3);
  }

  .account-handle {
    font-family: var(--g-font-mono);
    font-size: 10px;
    color: var(--g-text-3);
    letter-spacing: 0.02em;
  }

  .sign-out-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    background: none;
    border: none;
    color: var(--g-text-4);
    cursor: pointer;
    padding: 4px;
    margin-left: 4px;
    border-left: 1px solid var(--g-card-border);
    padding-left: 10px;
    transition: color var(--g-dur-fast) var(--g-ease);
  }
  .sign-out-btn:hover {
    color: var(--g-accent);
  }

  /* Connect CTA (signed out) — glass with accent tint */
  .connect-cta {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-family: var(--g-font);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    padding: 8px 18px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(255, 64, 64, 0.12) 0%, rgba(255, 64, 64, 0.06) 100%);
    border: 1px solid rgba(255, 64, 64, 0.15);
    color: var(--g-text);
    text-decoration: none;
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow:
      inset 0 1px 0 0 rgba(255, 255, 255, 0.06),
      0 2px 8px rgba(255, 64, 64, 0.08);
    transition:
      background var(--g-dur-fast) var(--g-ease),
      border-color var(--g-dur-fast) var(--g-ease),
      box-shadow var(--g-dur-fast) var(--g-ease);
  }
  .connect-cta:hover {
    background: linear-gradient(135deg, rgba(255, 64, 64, 0.18) 0%, rgba(255, 64, 64, 0.1) 100%);
    border-color: rgba(255, 64, 64, 0.22);
    box-shadow:
      inset 0 1px 0 0 rgba(255, 255, 255, 0.08),
      0 4px 16px rgba(255, 64, 64, 0.12);
  }

  .connect-cta--resync {
    background: linear-gradient(135deg, rgba(255, 184, 77, 0.18) 0%, rgba(255, 184, 77, 0.08) 100%);
    border-color: rgba(255, 184, 77, 0.28);
  }
  .connect-cta--resync:hover {
    background: linear-gradient(135deg, rgba(255, 184, 77, 0.26) 0%, rgba(255, 184, 77, 0.12) 100%);
    border-color: rgba(255, 184, 77, 0.36);
    box-shadow:
      inset 0 1px 0 0 rgba(255, 255, 255, 0.08),
      0 4px 16px rgba(255, 184, 77, 0.18);
  }

  /* ── Session-out-of-sync banner ── */
  .resync-banner {
    display: flex;
    align-items: center;
    gap: 14px;
    max-width: 80rem;
    margin: 16px auto 0;
    padding: 12px 20px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(255, 184, 77, 0.12), rgba(255, 184, 77, 0.04));
    border: 1px solid rgba(255, 184, 77, 0.32);
    color: var(--g-text, #ededef);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
  }
  .resync-banner__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #ffb84d;
    box-shadow: 0 0 12px rgba(255, 184, 77, 0.6);
    flex-shrink: 0;
  }
  .resync-banner__body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
    line-height: 1.4;
  }
  .resync-banner__body strong {
    font-weight: 600;
  }
  .resync-banner__btn {
    margin-left: auto;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 12px;
    font-weight: 600;
    color: #1a1a1a;
    background: #ffb84d;
    text-decoration: none;
    white-space: nowrap;
  }
  .resync-banner__btn:hover {
    background: #ffc970;
  }

  /* ================================================================
     MAIN CONTENT
     ================================================================ */
  .glass-main {
    flex: 1 1 0;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    -webkit-overflow-scrolling: touch;
    position: relative;
    z-index: 1;
  }

  /* ================================================================
     MOBILE
     ================================================================ */
  .mobile-toggle {
    background: none;
    border: none;
    color: var(--g-text-3);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
  }

  /* Mobile overlay — glass panel */
  .mobile-overlay {
    display: flex;
    flex-direction: column;
    padding: 12px 24px 20px;
    gap: 2px;
    background: rgba(255, 255, 255, 0.02);
    border-top: 1px solid var(--g-card-border);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
  }

  .mobile-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px 12px;
    border-radius: 10px;
    text-decoration: none;
    font-family: var(--g-font);
    font-size: 13px;
    font-weight: 500;
    color: var(--g-text-3);
    background: none;
    border: none;
    cursor: pointer;
    transition:
      color var(--g-dur-fast) var(--g-ease),
      background var(--g-dur-fast) var(--g-ease);
  }
  .mobile-link:hover {
    color: var(--g-text);
    background: rgba(255, 255, 255, 0.03);
  }
  .mobile-link.active {
    color: var(--g-text);
    background: rgba(255, 255, 255, 0.04);
  }

  .mobile-link--signout {
    color: var(--g-accent);
  }
  .mobile-link--signout:hover {
    opacity: 0.8;
  }

  .mobile-divider {
    height: 1px;
    background: var(--g-card-border);
    margin: 6px 12px;
  }

  /* ================================================================
     RESPONSIVE UTILS
     ================================================================ */
  .desktop-only {
    display: none;
  }
  .desktop-hidden {
    display: flex;
  }

  @media (min-width: 768px) {
    .desktop-only {
      display: flex;
    }
    .desktop-hidden {
      display: none !important;
    }
  }

  /* ── Mobile: smaller orbs, stacked topbar ── */
  @media (max-width: 767px) {
    .orb-red {
      width: 300px;
      height: 300px;
    }
    .orb-blue {
      width: 280px;
      height: 280px;
    }
    .orb-gold {
      width: 260px;
      height: 260px;
    }
    .orb-purple {
      width: 240px;
      height: 240px;
    }

    .topbar-inner {
      height: auto;
      min-height: 52px;
      flex-wrap: wrap;
      padding: 10px 16px;
      gap: 8px;
    }

    .topbar-left {
      flex: 1;
      min-width: 0;
    }
    .topbar-right {
      flex-shrink: 0;
    }
  }
</style>
