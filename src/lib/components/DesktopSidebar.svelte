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

<aside class="sidebar-rail" aria-label="Main navigation">
  <div class="sidebar-rail__brand" aria-hidden="true">
    <img src="/logo-white.svg" alt="WagwanAI" class="sidebar-rail__brand-logo" />
    <img src="/favicon.png" alt="W" class="sidebar-rail__brand-icon" />
  </div>
  <nav class="sidebar-rail__nav">
    <a
      href="/home"
      class="sidebar-rail__link"
      class:sidebar-rail__link--active={homeActive}
      aria-current={homeActive ? 'page' : undefined}
      title="Home"
    >
      <House size={22} weight="light" />
      <span class="sidebar-rail__label">Home</span>
    </a>
    <a
      href="/ai"
      class="sidebar-rail__link"
      class:sidebar-rail__link--active={chatActive}
      class:sidebar-rail__link--lime={chatActive}
      aria-current={chatActive ? 'page' : undefined}
      title="Chat"
    >
      <ChatCircle size={22} weight="light" />
      <span class="sidebar-rail__label">Chat</span>
    </a>
    <a
      href="/profile"
      class="sidebar-rail__link"
      class:sidebar-rail__link--active={profileActive}
      aria-current={profileActive ? 'page' : undefined}
      title="Profile"
    >
      <UserCircle size={22} weight="light" />
      <span class="sidebar-rail__label">Profile</span>
    </a>
  </nav>
  <p class="sidebar-rail__footer">
    <a href="/brands" class="sidebar-rail__footer-link" title="For brands">For brands</a>
  </p>
</aside>

<style>
  .sidebar-rail {
    display: none;
    flex-direction: column;
    flex-shrink: 0;
    min-height: 0;
    z-index: 30;
    /* Match Home `.home-identity-col` glass rail */
    border-right: 1px solid var(--panel-border);
    background: color-mix(in srgb, var(--glass-light) 86%, transparent);
    backdrop-filter: blur(18px) saturate(1.06);
    -webkit-backdrop-filter: blur(18px) saturate(1.06);
    box-shadow: 4px 0 28px rgba(0, 0, 0, 0.12);
  }

  /* Tablet+: icon-first rail */
  @media (min-width: 768px) and (max-width: 1023px) {
    .sidebar-rail {
      display: flex;
      width: 72px;
      padding: 20px 8px 16px;
      align-items: center;
    }

    .sidebar-rail__brand-logo {
      display: none;
    }

    .sidebar-rail__brand-icon {
      display: block;
      width: 32px;
      height: 32px;
      border-radius: 8px;
    }

    .sidebar-rail__brand {
      padding: 0 0 20px;
      text-align: center;
      width: 100%;
      display: flex;
      justify-content: center;
    }

    .sidebar-rail__label {
      display: none;
    }

    .sidebar-rail__link {
      justify-content: center;
      gap: 0;
      padding: 12px 10px;
    }

    .sidebar-rail__footer {
      display: none;
    }
  }

  @media (min-width: 1024px) {
    .sidebar-rail {
      display: flex;
      width: 220px;
      padding: 28px var(--home-layout-gutter, 16px) 24px;
      align-items: stretch;
    }

    .sidebar-rail__brand-logo {
      display: block;
      height: 18px;
      width: auto;
      opacity: 0.85;
    }

    .sidebar-rail__brand-icon {
      display: none;
    }

    .sidebar-rail__label {
      display: inline;
    }

    .sidebar-rail__link {
      justify-content: flex-start;
      gap: 14px;
      padding: 12px 14px;
    }

    .sidebar-rail__footer {
      display: block;
    }
  }

  .sidebar-rail__brand {
    padding: 0 12px 24px;
  }

  .sidebar-rail__brand-logo {
    display: none;
    height: 18px;
    width: auto;
  }

  .sidebar-rail__brand-icon {
    display: none;
    width: 32px;
    height: 32px;
    border-radius: 8px;
  }

  .sidebar-rail__nav {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 6px;
  }

  .sidebar-rail__footer {
    margin-top: auto;
    padding: 20px 12px 0;
    font-size: 12px;
    color: var(--text-muted);
  }

  .sidebar-rail__footer-link {
    color: var(--text-muted);
    text-decoration: none;
  }

  .sidebar-rail__footer-link:hover {
    color: var(--accent-primary);
    text-decoration: underline;
  }

  .sidebar-rail__link {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 12px 14px;
    border-radius: 14px;
    text-decoration: none;
    color: var(--text-secondary);
    font-size: 15px;
    font-weight: 500;
    transition:
      background 0.2s ease,
      color 0.2s ease,
      box-shadow 0.2s ease;
    border: 1px solid transparent;
  }

  .sidebar-rail__link:hover {
    color: var(--text-primary);
    background: var(--glass-light);
    border-color: var(--border-subtle);
  }

  .sidebar-rail__link--active {
    color: var(--accent-primary);
    background: color-mix(in srgb, var(--accent-soft) 65%, transparent);
    border-color: color-mix(in srgb, var(--accent-primary) 18%, transparent);
    box-shadow: 0 0 20px color-mix(in srgb, var(--accent-glow) 35%, transparent);
  }

  .sidebar-rail__link--lime.sidebar-rail__link--active {
    color: var(--home-accent, #FF4D4D);
    background: color-mix(in srgb, var(--home-accent, #FF4D4D) 12%, transparent);
    border-color: color-mix(in srgb, var(--home-accent, #FF4D4D) 22%, transparent);
    box-shadow: 0 0 20px color-mix(in srgb, var(--home-accent, #FF4D4D) 25%, transparent);
  }

  @media (prefers-reduced-motion: reduce) {
    .sidebar-rail__link {
      transition-duration: 0.01ms;
    }
  }
</style>
