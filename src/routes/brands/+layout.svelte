<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  $: onPortal = $page.url.pathname.startsWith('/brands/portal');
  $: onLogin = $page.url.pathname.startsWith('/brands/login');

  $: isAuthenticated = browser && document.cookie.includes('wagwan_brand_session');

  let mobileMenuOpen = false;
</script>

<div class="brands-shell" data-app-chrome="dark">
  <!-- Ambient mesh -->
  <div class="brands-mesh" aria-hidden="true">
    <div class="brands-orb brands-orb--red"></div>
    <div class="brands-orb brands-orb--blue"></div>
    <div class="brands-orb brands-orb--gold"></div>
  </div>

  <header class="brands-header">
    <div class="header-inner">
      <!-- Branded wordmark -->
      <a href="/brands" class="wordmark">
        <img src="/logo-white.svg" alt="WagwanAI" class="wordmark-logo" />
      </a>

      <!-- Center nav -->
      <nav class="nav-center desktop-only">
        <a href="/brands" class="nav-link" class:active={$page.url.pathname === '/brands'}>Home</a>
        <a href="/brands/portal" class="nav-link" class:active={onPortal}>Audience</a>
        <a href="/brands/creators" class="nav-link" class:active={$page.url.pathname.startsWith('/brands/creators')}>Creators</a>
      </nav>

      <!-- Right actions -->
      <div class="header-actions">
        <a href="/" class="nav-pill desktop-only">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="6" cy="6" r="2" fill="var(--accent-primary)"/><circle cx="6" cy="6" r="5" stroke="var(--accent-primary)" stroke-width="0.8" opacity="0.4"/></svg>
          <span>Web App</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5h6M5 2l3 3-3 3" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/></svg>
        </a>
        {#if isAuthenticated}
          <a href="/brands/login" class="auth-btn">Sign out</a>
        {:else if !onLogin}
          <a href="/brands/login?next=/brands/portal" class="auth-btn auth-btn--primary">Sign in</a>
        {/if}
        <button
          class="mobile-toggle desktop-hidden"
          on:click={() => (mobileMenuOpen = !mobileMenuOpen)}
          aria-label="Toggle menu"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            {#if mobileMenuOpen}
              <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            {:else}
              <path d="M2 5h14M2 9h14M2 13h14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
            {/if}
          </svg>
        </button>
      </div>
    </div>

    {#if mobileMenuOpen}
      <nav class="mobile-nav desktop-hidden">
        <a href="/brands" class="nav-link" class:active={$page.url.pathname === '/brands'} on:click={() => (mobileMenuOpen = false)}>Home</a>
        <a href="/brands/portal" class="nav-link" class:active={onPortal} on:click={() => (mobileMenuOpen = false)}>Audience</a>
        <a href="/brands/creators" class="nav-link" class:active={$page.url.pathname.startsWith('/brands/creators')} on:click={() => (mobileMenuOpen = false)}>Creators</a>
        <a href="/" class="nav-link" on:click={() => (mobileMenuOpen = false)}>Web App</a>
      </nav>
    {/if}
  </header>

  <main class="brands-main">
    <slot />
  </main>
</div>

<style>
  .brands-shell {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--bg-primary);
    color: var(--text-primary);
    font-family: var(--font-sans);
    -webkit-font-smoothing: antialiased;
    overflow: hidden;
  }

  /* ── Header ── */
  .brands-header {
    position: sticky;
    top: 0;
    z-index: 50;
    border-bottom: 1px solid var(--border-subtle);
    background: color-mix(in srgb, var(--bg-primary) 85%, transparent);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
  }

  .header-inner {
    max-width: 72rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 0.75rem 1.25rem;
  }

  /* ── Wordmark ── */
  .wordmark {
    display: flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    transition: opacity 0.2s;
  }
  .wordmark:hover { opacity: 0.85; }

  .wordmark-logo {
    height: 20px;
    width: auto;
  }

  /* ── Center nav ── */
  .nav-center {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 4px;
    border-radius: 10px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
  }

  .nav-link {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--text-muted);
    text-decoration: none;
    padding: 6px 14px;
    border-radius: 8px;
    transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .nav-link:hover {
    color: var(--text-secondary);
    background: var(--glass-light);
  }

  .nav-link.active {
    color: var(--text-primary);
    background: var(--glass-medium);
    font-weight: 600;
  }

  /* ── Right actions ── */
  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .nav-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
    text-decoration: none;
    padding: 6px 12px;
    border-radius: 9999px;
    border: 1px solid var(--border-subtle);
    transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .nav-pill:hover {
    color: var(--text-primary);
    border-color: rgba(255, 77, 77, 0.25);
    background: rgba(255, 77, 77, 0.04);
  }

  .auth-btn {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
    text-decoration: none;
    padding: 6px 14px;
    border-radius: 9999px;
    border: 1px solid var(--border-subtle);
    transition: all 0.25s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .auth-btn:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }

  .auth-btn--primary {
    background: var(--accent-primary);
    border-color: var(--accent-primary);
    color: white;
    font-weight: 600;
  }
  .auth-btn--primary:hover {
    color: white;
    opacity: 0.9;
    border-color: var(--accent-primary);
  }

  /* ── Mobile ── */
  .mobile-toggle {
    background: none;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mobile-nav {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 8px 16px 12px;
    border-top: 1px solid var(--border-subtle);
  }
  .mobile-nav .nav-link {
    padding: 10px 8px;
    border-radius: 8px;
  }

  .desktop-only { display: none; }
  .desktop-hidden { display: flex; }

  @media (min-width: 640px) {
    .desktop-only { display: flex; }
    .desktop-hidden { display: none !important; }
  }

  /* ── Main ── */
  .brands-main {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    position: relative;
    z-index: 1;
  }

  /* ── Ambient mesh ── */
  .brands-mesh {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 0;
    overflow: hidden;
  }

  .brands-orb {
    position: absolute;
    border-radius: 50%;
    will-change: transform;
  }

  .brands-orb--red {
    width: 70vw;
    height: 70vw;
    max-width: 700px;
    max-height: 700px;
    top: -25%;
    left: -15%;
    background: radial-gradient(ellipse at center, rgba(255, 77, 77, 0.07), transparent 65%);
    filter: blur(60px);
    animation: orb-drift-1 22s cubic-bezier(0.32, 0.72, 0, 1) infinite;
  }

  .brands-orb--blue {
    width: 55vw;
    height: 55vw;
    max-width: 550px;
    max-height: 550px;
    top: 10%;
    right: -10%;
    background: radial-gradient(ellipse at center, rgba(77, 124, 255, 0.06), transparent 65%);
    filter: blur(60px);
    animation: orb-drift-2 26s cubic-bezier(0.32, 0.72, 0, 1) infinite;
  }

  .brands-orb--gold {
    width: 50vw;
    height: 50vw;
    max-width: 500px;
    max-height: 500px;
    bottom: -10%;
    right: 20%;
    background: radial-gradient(ellipse at center, rgba(255, 184, 77, 0.04), transparent 65%);
    filter: blur(60px);
    animation: orb-drift-3 30s cubic-bezier(0.32, 0.72, 0, 1) infinite;
  }

  @keyframes orb-drift-1 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(4vw, 3vh); }
  }
  @keyframes orb-drift-2 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-3vw, 4vh); }
  }
  @keyframes orb-drift-3 {
    0%, 100% { transform: translate(0, 0); }
    50% { transform: translate(-2vw, -3vh); }
  }
</style>
