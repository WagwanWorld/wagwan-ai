<script lang="ts">
  import { page } from '$app/stores';
  import House from 'phosphor-svelte/lib/House';
  import Briefcase from 'phosphor-svelte/lib/Briefcase';
  import CurrencyCircleDollar from 'phosphor-svelte/lib/CurrencyCircleDollar';
  import UserCircle from 'phosphor-svelte/lib/UserCircle';
  import Sun from 'phosphor-svelte/lib/Sun';
  import Moon from 'phosphor-svelte/lib/Moon';
  import { themeMode, toggleThemeMode } from '$lib/stores/theme';

  $: path = $page.url.pathname;
  $: homeActive = path === '/home';
  $: briefsActive = path === '/briefs' || path.startsWith('/briefs/');
  $: earnActive = path === '/earn';
  $: profileActive = path === '/profile';
  $: isDark = $themeMode === 'dark';
</script>

<aside class="sidebar" class:sidebar--light={!isDark} aria-label="Main navigation">
  <div class="sidebar-brand">
    <img
      src={isDark ? '/logo-white.svg' : '/logo-black.svg'}
      alt="WagwanAI"
      class="sidebar-logo"
      on:error={(e) => {
        (e.currentTarget as HTMLImageElement).src = '/logo-white.svg';
      }}
    />
    <img src="/favicon.png" alt="W" class="sidebar-icon" />
  </div>
  <nav class="sidebar-nav">
    <a href="/home" class="sidebar-link" class:sidebar-link--active={homeActive} title="Home">
      <House size={18} weight={homeActive ? 'fill' : 'regular'} />
      <span class="sidebar-label">Home</span>
    </a>
    <a href="/briefs" class="sidebar-link" class:sidebar-link--active={briefsActive} title="Briefs">
      <Briefcase size={18} weight={briefsActive ? 'fill' : 'regular'} />
      <span class="sidebar-label">Briefs</span>
    </a>
    <a href="/earn" class="sidebar-link" class:sidebar-link--active={earnActive} title="Earn">
      <CurrencyCircleDollar size={18} weight={earnActive ? 'fill' : 'regular'} />
      <span class="sidebar-label">Earn</span>
    </a>
    <a
      href="/profile"
      class="sidebar-link"
      class:sidebar-link--active={profileActive}
      title="Profile"
    >
      <UserCircle size={18} weight={profileActive ? 'fill' : 'regular'} />
      <span class="sidebar-label">Profile</span>
    </a>
  </nav>
  <div class="sidebar-bottom">
    <button
      class="theme-toggle"
      on:click={toggleThemeMode}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Light mode' : 'Dark mode'}
    >
      {#if isDark}
        <Sun size={16} />
        <span class="theme-toggle__label">Light</span>
      {:else}
        <Moon size={16} />
        <span class="theme-toggle__label">Dark</span>
      {/if}
    </button>
    <p class="sidebar-footer">
      <a href="/brands" class="sidebar-footer-link">For brands</a>
    </p>
    <div class="sidebar-contact">
      <img src="/wagwan-logo-white.svg" alt="Wagwan" class="sidebar-contact-logo" />
      <a href="mailto:madhvik@wagwanworld.in" class="sidebar-contact-link">madhvik@wagwanworld.in</a
      >
      <div class="sidebar-contact-socials">
        <a
          href="https://instagram.com/wagwan.world"
          target="_blank"
          rel="noopener"
          class="sidebar-contact-social">Instagram</a
        >
        <a
          href="https://linkedin.com/company/wagwan-world"
          target="_blank"
          rel="noopener"
          class="sidebar-contact-social">LinkedIn</a
        >
      </div>
    </div>
  </div>
</aside>

<style>
  .sidebar {
    display: none;
    flex-direction: column;
    flex-shrink: 0;
    min-height: 0;
    z-index: 30;
    background: #0a0a0c;
    border-right: 1px solid rgba(255, 255, 255, 0.04);
    transition:
      background 0.3s ease,
      border-color 0.3s ease;
  }

  .sidebar--light {
    background: #fafafa;
    border-right-color: rgba(0, 0, 0, 0.06);
  }

  @media (min-width: 768px) and (max-width: 1023px) {
    .sidebar {
      display: flex;
      width: 60px;
      padding: 20px 8px 16px;
      align-items: center;
    }
    .sidebar-logo {
      display: none;
    }
    .sidebar-icon {
      display: block;
      width: 28px;
      height: 28px;
      border-radius: 6px;
    }
    .sidebar-brand {
      padding: 0 0 24px;
      text-align: center;
      width: 100%;
      display: flex;
      justify-content: center;
    }
    .sidebar-label {
      display: none;
    }
    .sidebar-link {
      justify-content: center;
      gap: 0;
      padding: 10px;
    }
    .sidebar-footer {
      display: none;
    }
    .theme-toggle__label {
      display: none;
    }
    .theme-toggle {
      justify-content: center;
      padding: 8px;
    }
  }

  @media (min-width: 1024px) {
    .sidebar {
      display: flex;
      width: 180px;
      padding: 24px 16px 20px;
      align-items: stretch;
    }
    .sidebar-logo {
      display: block;
      height: 14px;
      width: auto;
      opacity: 0.4;
    }
    .sidebar-icon {
      display: none;
    }
    .sidebar-label {
      display: inline;
    }
    .sidebar-link {
      justify-content: flex-start;
      gap: 10px;
      padding: 9px 12px;
    }
    .sidebar-footer {
      display: block;
    }
    .theme-toggle__label {
      display: inline;
    }
  }

  .sidebar-brand {
    padding: 0 4px 28px;
  }
  .sidebar-logo {
    display: none;
  }
  .sidebar-icon {
    display: none;
  }

  .sidebar-nav {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
    gap: 2px;
  }

  .sidebar-link {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    border-radius: 10px;
    text-decoration: none;
    color: #4a4a50;
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 500;
    transition:
      color 0.15s ease,
      background 0.15s ease;
    border: 1px solid transparent;
  }

  .sidebar--light .sidebar-link {
    color: #8a8a95;
  }

  .sidebar-link:hover {
    color: #8a8a90;
    background: rgba(255, 255, 255, 0.02);
  }

  .sidebar--light .sidebar-link:hover {
    color: #555;
    background: rgba(0, 0, 0, 0.03);
  }

  .sidebar-link--active {
    color: #c4f24a;
    background: rgba(196, 242, 74, 0.08);
    border-color: rgba(196, 242, 74, 0.14);
  }

  .sidebar--light .sidebar-link--active {
    color: #c4f24a;
    background: rgba(196, 242, 74, 0.1);
    border-color: rgba(196, 242, 74, 0.16);
  }

  .sidebar-bottom {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .theme-toggle {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 10px;
    border: 1px solid rgba(255, 255, 255, 0.06);
    background: rgba(255, 255, 255, 0.03);
    color: #6d7684;
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition:
      color 0.15s ease,
      background 0.15s ease,
      border-color 0.15s ease;
  }

  .theme-toggle:hover {
    color: #9aa3b2;
    background: rgba(255, 255, 255, 0.05);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .sidebar--light .theme-toggle {
    border-color: rgba(0, 0, 0, 0.08);
    background: rgba(0, 0, 0, 0.02);
    color: #888;
  }

  .sidebar--light .theme-toggle:hover {
    color: #555;
    background: rgba(0, 0, 0, 0.04);
    border-color: rgba(0, 0, 0, 0.12);
  }

  .sidebar-footer {
    padding: 0 4px;
  }

  .sidebar-footer-link {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px;
    color: #2a2a30;
    text-decoration: none;
    letter-spacing: 0.04em;
  }

  .sidebar--light .sidebar-footer-link {
    color: #bbbbc0;
  }

  .sidebar-footer-link:hover {
    color: #4a4a50;
  }

  .sidebar--light .sidebar-footer-link:hover {
    color: #888;
  }

  .sidebar-contact {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-top: 12px;
    border-top: 1px solid rgba(255, 255, 255, 0.04);
    margin-top: 8px;
  }

  .sidebar-contact-logo {
    height: 11px;
    width: auto;
    opacity: 0.25;
  }

  .sidebar-contact-link {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    color: rgba(255, 248, 232, 0.25);
    text-decoration: none;
    letter-spacing: 0.02em;
  }
  .sidebar-contact-link:hover {
    color: rgba(255, 248, 232, 0.5);
  }

  .sidebar-contact-socials {
    display: flex;
    gap: 8px;
  }
  .sidebar-contact-social {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    color: rgba(255, 248, 232, 0.2);
    text-decoration: none;
    letter-spacing: 0.02em;
  }
  .sidebar-contact-social:hover {
    color: #c4f24a;
  }

  .sidebar--light .sidebar-contact {
    border-top-color: rgba(0, 0, 0, 0.04);
  }
  .sidebar--light .sidebar-contact-logo {
    opacity: 0.15;
  }
  .sidebar--light .sidebar-contact-link {
    color: rgba(0, 0, 0, 0.25);
  }
  .sidebar--light .sidebar-contact-link:hover {
    color: rgba(0, 0, 0, 0.5);
  }
  .sidebar--light .sidebar-contact-social {
    color: rgba(0, 0, 0, 0.2);
  }
  .sidebar--light .sidebar-contact-social:hover {
    color: #c4f24a;
  }

  @media (min-width: 768px) and (max-width: 1023px) {
    .sidebar-contact {
      display: none;
    }
  }
</style>
