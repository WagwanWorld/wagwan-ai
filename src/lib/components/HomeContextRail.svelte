<script lang="ts">
  import { page } from '$app/stores';
  import House from 'phosphor-svelte/lib/House';
  import ChatCircle from 'phosphor-svelte/lib/ChatCircle';
  import UserCircle from 'phosphor-svelte/lib/UserCircle';

  /** ISO timestamp of last profile sync, if known */
  export let profileUpdatedAt: string | undefined = undefined;

  $: path = $page.url.pathname;
  $: homeActive = path === '/home';
  $: chatActive = path === '/ai' || path.startsWith('/chat/');
  $: profileActive = path === '/profile';

  function fmtSync(iso: string | undefined): string {
    if (!iso?.trim()) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const days = Math.floor(diffMs / (86400 * 1000));
    if (days <= 0) return 'Synced today';
    if (days === 1) return 'Synced yesterday';
    if (days < 7) return `Synced ${days}d ago`;
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  $: syncLine = fmtSync(profileUpdatedAt);
</script>

<aside class="context-rail" aria-label="Context">
  <nav class="context-rail__nav" aria-label="Primary">
    <a
      href="/home"
      class="context-rail__nav-hit"
      class:context-rail__nav-hit--active={homeActive}
      title="Home"
      aria-current={homeActive ? 'page' : undefined}
    >
      <House size={20} weight="light" />
      <span class="context-rail__nav-txt">Home</span>
    </a>
    <a
      href="/ai"
      class="context-rail__nav-hit"
      class:context-rail__nav-hit--active={chatActive}
      class:context-rail__nav-hit--lime={chatActive}
      title="Chat"
      aria-current={chatActive ? 'page' : undefined}
    >
      <ChatCircle size={20} weight="light" />
      <span class="context-rail__nav-txt">Chat</span>
    </a>
    <a
      href="/profile"
      class="context-rail__nav-hit"
      class:context-rail__nav-hit--active={profileActive}
      title="Profile"
      aria-current={profileActive ? 'page' : undefined}
    >
      <UserCircle size={20} weight="light" />
      <span class="context-rail__nav-txt">Profile</span>
    </a>
  </nav>

  <div class="context-rail__orb-wrap" aria-hidden="true">
    <div class="context-rail__orb"></div>
  </div>

  <div class="context-rail__pulse">
    {#if syncLine}
      <p class="context-rail__line">{syncLine}</p>
    {:else}
      <p class="context-rail__line">Profile sync pending</p>
    {/if}
    <p class="context-rail__line context-rail__line--soft">Ask your twin to sharpen the read</p>
  </div>
</aside>

<style>
  .context-rail {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--home-section-gap, 32px);
    padding: 12px 8px 20px;
    opacity: 0.92;
    min-height: 0;
    width: 100%;
    border-radius: 18px;
    border: 1px solid var(--border-subtle);
    background: color-mix(in srgb, var(--glass-light) 88%, transparent);
    backdrop-filter: blur(var(--blur-medium, 14px));
    -webkit-backdrop-filter: blur(var(--blur-medium, 14px));
  }

  @media (max-width: 1023px) {
    .context-rail {
      flex-direction: row;
      flex-wrap: wrap;
      justify-content: center;
      align-items: center;
      gap: 16px 20px;
      padding: 10px 12px;
      width: 100%;
    }

    .context-rail__pulse {
      flex: 1 1 100%;
      text-align: center;
      max-width: 280px;
    }
  }

  .context-rail__nav {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }

  @media (max-width: 1023px) {
    .context-rail__nav {
      flex-direction: row;
    }
  }

  .context-rail__nav-hit {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    width: 48px;
    padding: 12px 10px;
    border-radius: 14px;
    text-decoration: none;
    color: var(--text-secondary);
    border: 1px solid transparent;
    transition:
      color 0.2s ease,
      background 0.2s ease,
      border-color 0.2s ease,
      box-shadow 0.2s ease,
      transform 0.15s ease;
  }

  .context-rail__nav-hit:hover {
    color: var(--text-primary);
    background: var(--glass-light);
    border-color: var(--border-subtle);
  }

  .context-rail__nav-hit--active {
    color: var(--accent-primary);
    background: color-mix(in srgb, var(--accent-soft) 65%, transparent);
    border-color: color-mix(in srgb, var(--accent-primary) 18%, transparent);
    box-shadow: 0 0 20px color-mix(in srgb, var(--accent-glow) 35%, transparent);
  }

  .context-rail__nav-hit--lime.context-rail__nav-hit--active {
    color: var(--home-lime, #b8f24a);
    background: color-mix(in srgb, var(--home-lime, #b8f24a) 12%, transparent);
    border-color: color-mix(in srgb, var(--home-lime, #b8f24a) 22%, transparent);
    box-shadow: 0 0 20px color-mix(in srgb, var(--home-lime, #b8f24a) 25%, transparent);
  }

  @media (min-width: 1024px) {
    .context-rail__nav-hit {
      width: 100%;
      max-width: 160px;
    }
  }

  .context-rail__nav-txt {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    max-height: 0;
    opacity: 0;
    overflow: hidden;
    transition:
      max-height 0.2s ease,
      opacity 0.2s ease;
  }

  @media (min-width: 1024px) {
    .context-rail__nav-txt {
      max-height: 24px;
      opacity: 1;
    }
  }

  @media (max-width: 1023px) {
    .context-rail__nav-txt {
      display: none;
    }
  }

  .context-rail__orb-wrap {
    display: flex;
    justify-content: center;
  }

  @media (max-width: 1023px) {
    .context-rail__orb-wrap {
      display: none;
    }
  }

  .context-rail__orb {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background:
      radial-gradient(circle at 30% 25%, rgba(255, 255, 255, 0.35), transparent 40%),
      radial-gradient(
        circle at 50% 50%,
        rgba(196, 242, 74, 0.28) 0%,
        rgba(34, 211, 238, 0.12) 50%,
        rgba(8, 10, 14, 0.92) 70%
      );
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.06),
      0 0 28px rgba(196, 242, 74, 0.18);
  }

  @media (prefers-reduced-motion: no-preference) {
    .context-rail__orb {
      animation: context-orb-breathe 14s ease-in-out infinite alternate;
    }
  }

  @keyframes context-orb-breathe {
    from {
      transform: scale(1);
      filter: hue-rotate(0deg);
    }
    to {
      transform: scale(1.04);
      filter: hue-rotate(6deg);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .context-rail__orb {
      animation: none;
    }
  }

  .context-rail__pulse {
    text-align: center;
    max-width: 140px;
  }

  .context-rail__line {
    margin: 0 0 6px;
    font-size: var(--home-font-meta, 11px);
    line-height: 1.45;
    color: var(--text-secondary);
  }

  .context-rail__line:last-child {
    margin-bottom: 0;
  }

  .context-rail__line--soft {
    color: var(--text-muted);
    opacity: 0.85;
  }
</style>
