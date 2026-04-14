<script lang="ts">
  import { page } from '$app/stores';
  import { browser } from '$app/environment';

  $: onPortal = $page.url.pathname.startsWith('/brands/portal');
  $: onLogin = $page.url.pathname.startsWith('/brands/login');

  $: isAuthenticated = browser && document.cookie.includes('wagwan_brand_session');

  let mobileMenuOpen = false;
</script>

<div class="brands-shell" data-app-chrome="dark">
  <header class="brands-header">
    <div class="header-inner">
      <a href="/brands" class="wordmark">
        wagwan<span class="dot" aria-hidden="true">.</span>
      </a>

      <nav class="nav-links desktop-only">
        <a href="/brands/portal" class="nav-link" class:active={onPortal}>Audience</a>
      </nav>

      <div class="header-actions">
        <a href="/" class="creator-link">For creators</a>
        {#if isAuthenticated}
          <a href="/brands/login" class="auth-btn">Sign out</a>
        {:else if !onLogin}
          <a href="/brands/login?next=/brands/portal" class="auth-btn">Sign in</a>
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
        <a href="/brands/portal" class="nav-link" class:active={onPortal} on:click={() => (mobileMenuOpen = false)}>Audience</a>
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
    background: var(--bg-primary, oklch(8% 0.008 260));
    color: var(--text-primary, #e8ecf3);
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    -webkit-font-smoothing: antialiased;
  }

  .brands-header {
    position: sticky;
    top: 0;
    z-index: 50;
    border-bottom: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: color-mix(in srgb, var(--bg-primary, oklch(8% 0.008 260)) 80%, transparent);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .header-inner {
    max-width: 72rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1.5rem;
    padding: 0.875rem 1rem;
  }

  .wordmark {
    font-size: 0.875rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--text-secondary, #9aa3b2);
    text-decoration: none;
    transition: color 0.2s;
  }

  .wordmark:hover {
    color: var(--text-primary, #e8ecf3);
  }

  .dot {
    color: var(--accent-primary, #FF4D4D);
  }

  .nav-links {
    display: flex;
    align-items: center;
    gap: 2rem;
  }

  .nav-link {
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    color: var(--text-muted, #6d7684);
    text-decoration: none;
    transition: color 0.2s;
  }

  .nav-link:hover,
  .nav-link.active {
    color: var(--text-primary, #e8ecf3);
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .creator-link {
    font-size: 0.75rem;
    color: var(--text-muted, #6d7684);
    text-decoration: none;
    transition: color 0.2s;
  }

  .creator-link:hover {
    color: var(--text-secondary, #9aa3b2);
  }

  .auth-btn {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary, #9aa3b2);
    text-decoration: none;
    padding: 0.375rem 0.875rem;
    border-radius: 9999px;
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--glass-light, rgba(255, 255, 255, 0.055));
    transition: all 0.2s;
  }

  .auth-btn:hover {
    color: var(--text-primary, #e8ecf3);
    border-color: var(--border-strong, rgba(255, 255, 255, 0.14));
    background: var(--glass-medium, rgba(255, 255, 255, 0.08));
  }

  .mobile-toggle {
    background: none;
    border: none;
    color: var(--text-secondary, #9aa3b2);
    cursor: pointer;
    padding: 0.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .mobile-nav {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    padding: 0.5rem 1rem 0.75rem;
    border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
  }

  .mobile-nav .nav-link {
    padding: 0.5rem 0;
  }

  .desktop-only {
    display: none;
  }

  .desktop-hidden {
    display: flex;
  }

  @media (min-width: 640px) {
    .desktop-only {
      display: flex;
    }
    .desktop-hidden {
      display: none !important;
    }
  }

  .brands-main {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
  }
</style>
