<script lang="ts">
  import { page } from '$app/stores';
  import { Home, MessageCircle, User } from '@lucide/svelte';

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
      class:float-nav-hit--blue={homeActive}
      aria-label="Home"
      aria-current={homeActive ? 'page' : undefined}
    >
      <Home size={21} strokeWidth={homeActive ? 2.25 : 1.9} />
    </a>
    <a
      href="/ai"
      class="float-nav-hit"
      class:float-nav-hit--active={chatActive}
      class:float-nav-hit--lime={chatActive}
      aria-label="Chat"
      aria-current={chatActive ? 'page' : undefined}
    >
      <MessageCircle size={21} strokeWidth={chatActive ? 2.25 : 1.9} />
    </a>
    <a
      href="/profile"
      class="float-nav-hit"
      class:float-nav-hit--active={profileActive}
      class:float-nav-hit--rose={profileActive}
      aria-label="Profile"
      aria-current={profileActive ? 'page' : undefined}
    >
      <User size={21} strokeWidth={profileActive ? 2.25 : 1.9} />
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
    background:
      linear-gradient(var(--glass-strong), var(--glass-medium)) padding-box,
      linear-gradient(
          125deg,
          rgba(37, 99, 235, 0.35),
          rgba(220, 38, 38, 0.18),
          rgba(202, 138, 4, 0.26)
        )
        border-box;
    background-origin: padding-box, border-box;
    background-clip: padding-box, border-box;
    backdrop-filter: blur(var(--blur-medium)) saturate(1.05);
    -webkit-backdrop-filter: blur(var(--blur-medium)) saturate(1.05);
    box-shadow:
      0 8px 32px rgba(15, 20, 25, 0.12),
      0 1px 0 rgba(255, 255, 255, 0.85) inset;
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
    transition: transform 0.12s ease, color 0.12s ease, background 0.12s ease, box-shadow 0.12s ease;
  }

  .float-nav-hit:hover {
    color: var(--text-secondary);
    background: var(--panel-hover);
  }

  .float-nav-hit:active {
    transform: scale(0.9);
    transition-duration: 0.12s;
  }

  .float-nav-hit--active {
    transform: scale(1.02);
    color: var(--text-primary);
  }

  .float-nav-hit--blue.float-nav-hit--active {
    color: var(--accent-primary);
    background: var(--accent-soft);
    box-shadow: 0 0 20px var(--accent-glow);
  }

  .float-nav-hit--lime.float-nav-hit--active {
    color: var(--home-lime, #b8f24a);
    background: color-mix(in srgb, var(--home-lime, #b8f24a) 14%, transparent);
    box-shadow: 0 0 22px color-mix(in srgb, var(--home-lime, #b8f24a) 28%, transparent);
  }

  .float-nav-hit--rose.float-nav-hit--active {
    color: var(--state-error);
    background: rgba(248, 113, 113, 0.1);
    box-shadow: 0 0 20px rgba(248, 113, 113, 0.12);
  }

  @media (prefers-reduced-motion: reduce) {
    .float-nav-hit,
    .float-nav-hit--active {
      transition-duration: 0.01ms;
    }
  }
</style>
