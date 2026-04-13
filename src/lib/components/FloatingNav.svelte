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

<nav class="float-nav md:hidden" aria-label="Main navigation">
  <div class="float-nav-pill">
    <a
      href="/home"
      class="float-nav-hit"
      class:float-nav-hit--active={homeActive}
      aria-label="Home"
      aria-current={homeActive ? 'page' : undefined}
    >
      <span class="nav-item-wrap" class:nav-item--active={homeActive}>
        <House size={21} weight={homeActive ? 'fill' : 'light'} />
        <span class="nav-dot" aria-hidden="true"></span>
      </span>
    </a>
    <a
      href="/ai"
      class="float-nav-hit"
      class:float-nav-hit--active={chatActive}
      aria-label="Chat"
      aria-current={chatActive ? 'page' : undefined}
    >
      <span class="nav-item-wrap" class:nav-item--active={chatActive}>
        <ChatCircle size={21} weight={chatActive ? 'fill' : 'light'} />
        <span class="nav-dot" aria-hidden="true"></span>
      </span>
    </a>
    <a
      href="/profile"
      class="float-nav-hit"
      class:float-nav-hit--active={profileActive}
      aria-label="Profile"
      aria-current={profileActive ? 'page' : undefined}
    >
      <span class="nav-item-wrap" class:nav-item--active={profileActive}>
        <UserCircle size={21} weight={profileActive ? 'fill' : 'light'} />
        <span class="nav-dot" aria-hidden="true"></span>
      </span>
    </a>
  </div>
</nav>

<style>
  .float-nav {
    position: fixed;
    left: 50%;
    bottom: max(14px, env(safe-area-inset-bottom, 0px));
    transform: translateX(-50%);
    z-index: 70;
    pointer-events: none;
  }

  .float-nav-pill {
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 5px 7px;
    border-radius: 999px;
    border: 1px solid transparent;
    position: relative;
    backdrop-filter: blur(var(--blur-medium)) saturate(1.05);
    -webkit-backdrop-filter: blur(var(--blur-medium)) saturate(1.05);
    box-shadow:
      0 8px 32px rgba(15, 20, 25, 0.12),
      0 1px 0 rgba(255, 255, 255, 0.85) inset;
  }

  /* Grain overlay */
  .float-nav-pill::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
    background-size: 128px 128px;
    pointer-events: none;
    z-index: 1;
  }

  .float-nav-hit {
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    color: var(--text-muted);
    text-decoration: none;
    -webkit-tap-highlight-color: transparent;
    transition: transform var(--dur-micro) var(--ease-premium),
                color var(--dur-micro) var(--ease-premium);
  }

  .float-nav-hit:hover {
    color: var(--text-secondary);
  }

  .float-nav-hit:active {
    transform: scale(0.9);
  }

  .float-nav-hit--active {
    color: var(--accent-primary);
  }

  .nav-item-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Active nav dot indicator */
  .nav-dot {
    position: absolute;
    bottom: -6px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--accent-primary);
    opacity: 0;
    transition: opacity var(--dur-micro) var(--ease-premium);
  }

  .nav-item--active .nav-dot {
    opacity: 1;
    animation: dot-pulse 3s ease-in-out infinite;
  }

  @keyframes dot-pulse {
    0%, 100% { opacity: 0.6; }
    50% { opacity: 1; }
  }

  @media (prefers-reduced-motion: reduce) {
    .float-nav-hit,
    .float-nav-hit--active {
      transition-duration: 0.01ms;
    }
    .nav-item--active .nav-dot {
      animation: none;
      opacity: 1;
    }
  }
</style>
