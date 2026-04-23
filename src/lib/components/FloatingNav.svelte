<script lang="ts">
  import { page } from '$app/stores';
  import House from 'phosphor-svelte/lib/House';
  import ChatCircle from 'phosphor-svelte/lib/ChatCircle';
  import CurrencyCircleDollar from 'phosphor-svelte/lib/CurrencyCircleDollar';
  import UserCircle from 'phosphor-svelte/lib/UserCircle';
  import Sun from 'phosphor-svelte/lib/Sun';
  import Moon from 'phosphor-svelte/lib/Moon';
  import { themeMode, toggleThemeMode } from '$lib/stores/theme';

  $: path = $page.url.pathname;
  $: homeActive = path === '/home';
  $: chatActive = path === '/ai' || path.startsWith('/chat/');
  $: earnActive = path === '/earn';
  $: profileActive = path === '/profile';
  $: isDark = $themeMode === 'dark';
</script>

<!-- Mobile top bar -->
<header class="mobile-topbar" class:mobile-topbar--light={!isDark}>
  <img src={isDark ? '/logo-white.svg' : '/logo-black.svg'} alt="WagwanAI" class="mobile-topbar__logo" on:error={(e) => { (e.currentTarget as HTMLImageElement).src = '/logo-white.svg'; }} />
  <button
    class="mobile-theme-btn"
    on:click={toggleThemeMode}
    aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
  >
    {#if isDark}
      <Sun size={18} />
    {:else}
      <Moon size={18} />
    {/if}
  </button>
</header>

<!-- Mobile bottom tab bar -->
<nav class="bottom-tabs" class:bottom-tabs--light={!isDark} aria-label="Main navigation">
  <a
    href="/home"
    class="bottom-tab"
    class:bottom-tab--active={homeActive}
    aria-label="Home"
    aria-current={homeActive ? 'page' : undefined}
  >
    <House size={22} weight={homeActive ? 'fill' : 'regular'} />
    <span class="bottom-tab__label">Home</span>
  </a>
  <a
    href="/ai"
    class="bottom-tab"
    class:bottom-tab--active={chatActive}
    aria-label="Chat"
    aria-current={chatActive ? 'page' : undefined}
  >
    <ChatCircle size={22} weight={chatActive ? 'fill' : 'regular'} />
    <span class="bottom-tab__label">Chat</span>
  </a>
  <a
    href="/earn"
    class="bottom-tab"
    class:bottom-tab--active={earnActive}
    aria-label="Earn"
    aria-current={earnActive ? 'page' : undefined}
  >
    <CurrencyCircleDollar size={22} weight={earnActive ? 'fill' : 'regular'} />
    <span class="bottom-tab__label">Earn</span>
  </a>
  <a
    href="/profile"
    class="bottom-tab"
    class:bottom-tab--active={profileActive}
    aria-label="Profile"
    aria-current={profileActive ? 'page' : undefined}
  >
    <UserCircle size={22} weight={profileActive ? 'fill' : 'regular'} />
    <span class="bottom-tab__label">Profile</span>
  </a>
</nav>

<style>
  /* ── Mobile top bar ── */
  .mobile-topbar {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 60;
    height: 52px;
    padding: 0 20px;
    align-items: center;
    justify-content: space-between;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-subtle);
    transition: background 0.3s ease;
  }

  .mobile-topbar--light {
    background: #FAFAFA;
    border-bottom-color: rgba(0,0,0,0.06);
  }

  .mobile-topbar__logo {
    height: 16px;
    width: auto;
    opacity: 0.85;
  }

  .mobile-theme-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    border: 1px solid var(--border-subtle);
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }

  .mobile-theme-btn:hover {
    background: rgba(255,255,255,0.05);
    color: var(--text-secondary);
  }

  .mobile-topbar--light .mobile-theme-btn {
    border-color: rgba(0,0,0,0.08);
    color: #999;
  }

  .mobile-topbar--light .mobile-theme-btn:hover {
    background: rgba(0,0,0,0.03);
    color: #555;
  }

  /* ── Bottom tab bar ── */
  .bottom-tabs {
    display: none;
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 70;
    background: var(--bg-primary);
    border-top: 1px solid var(--border-subtle);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    transition: background 0.3s ease;
  }

  .bottom-tabs--light {
    background: #FAFAFA;
    border-top-color: rgba(0,0,0,0.06);
  }

  @media (max-width: 767px) {
    .mobile-topbar {
      display: flex;
    }

    .bottom-tabs {
      display: flex;
      align-items: stretch;
    }
  }

  .bottom-tab {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    padding: 8px 0 6px;
    text-decoration: none;
    color: var(--text-muted);
    -webkit-tap-highlight-color: transparent;
    transition: color 0.15s;
  }

  .bottom-tabs--light .bottom-tab {
    color: #BBBBC0;
  }

  .bottom-tab:active {
    transform: scale(0.92);
  }

  .bottom-tab--active {
    color: var(--accent-primary);
  }

  .bottom-tabs--light .bottom-tab--active {
    color: #E8833A;
  }

  .bottom-tab__label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
</style>
