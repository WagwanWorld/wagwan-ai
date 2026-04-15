<script lang="ts">
  import { page } from '$app/stores';
  import House from 'phosphor-svelte/lib/House';
  import ChatCircle from 'phosphor-svelte/lib/ChatCircle';
  import UserCircle from 'phosphor-svelte/lib/UserCircle';

  $: path = $page.url.pathname;
  $: homeActive = path === '/home';
  $: chatActive = path === '/ai' || path.startsWith('/chat/');
  $: profileActive = path === '/profile';
</script>

<!-- Mobile top bar -->
<header class="mobile-topbar">
  <img src="/logo-white.svg" alt="WagwanAI" class="mobile-topbar__logo" />
</header>

<!-- Mobile bottom tab bar -->
<nav class="bottom-tabs" aria-label="Main navigation">
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
    justify-content: center;
    background: var(--bg-primary);
    border-bottom: 1px solid var(--border-subtle);
  }

  .mobile-topbar__logo {
    height: 16px;
    width: auto;
    opacity: 0.85;
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

  .bottom-tab:active {
    transform: scale(0.92);
  }

  .bottom-tab--active {
    color: var(--accent-primary);
  }

  .bottom-tab__label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
  }
</style>
