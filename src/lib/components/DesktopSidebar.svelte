<script lang="ts">
  import { page } from '$app/stores';
  import House from 'phosphor-svelte/lib/House';
  import ChatCircle from 'phosphor-svelte/lib/ChatCircle';
  import CurrencyCircleDollar from 'phosphor-svelte/lib/CurrencyCircleDollar';
  import UserCircle from 'phosphor-svelte/lib/UserCircle';

  $: path = $page.url.pathname;
  $: homeActive = path === '/home';
  $: chatActive = path === '/ai' || path.startsWith('/chat/');
  $: earnActive = path === '/earn';
  $: profileActive = path === '/profile';
</script>

<aside class="sidebar" aria-label="Main navigation">
  <div class="sidebar-brand">
    <img src="/logo-white.svg" alt="WagwanAI" class="sidebar-logo" />
    <img src="/favicon.png" alt="W" class="sidebar-icon" />
  </div>
  <nav class="sidebar-nav">
    <a href="/home" class="sidebar-link" class:sidebar-link--active={homeActive} title="Home">
      <House size={18} weight={homeActive ? 'fill' : 'regular'} />
      <span class="sidebar-label">Home</span>
    </a>
    <a href="/ai" class="sidebar-link" class:sidebar-link--active={chatActive} title="Chat">
      <ChatCircle size={18} weight={chatActive ? 'fill' : 'regular'} />
      <span class="sidebar-label">Chat</span>
    </a>
    <a href="/earn" class="sidebar-link" class:sidebar-link--active={earnActive} title="Earn">
      <CurrencyCircleDollar size={18} weight={earnActive ? 'fill' : 'regular'} />
      <span class="sidebar-label">Earn</span>
    </a>
    <a href="/profile" class="sidebar-link" class:sidebar-link--active={profileActive} title="Profile">
      <UserCircle size={18} weight={profileActive ? 'fill' : 'regular'} />
      <span class="sidebar-label">Profile</span>
    </a>
  </nav>
  <p class="sidebar-footer">
    <a href="/brands" class="sidebar-footer-link">For brands</a>
  </p>
</aside>

<style>
  .sidebar {
    display: none;
    flex-direction: column;
    flex-shrink: 0;
    min-height: 0;
    z-index: 30;
    background: #0A0A0C;
    border-right: 1px solid rgba(255,255,255,0.04);
  }

  @media (min-width: 768px) and (max-width: 1023px) {
    .sidebar {
      display: flex;
      width: 60px;
      padding: 20px 8px 16px;
      align-items: center;
    }
    .sidebar-logo { display: none; }
    .sidebar-icon { display: block; width: 28px; height: 28px; border-radius: 6px; }
    .sidebar-brand { padding: 0 0 24px; text-align: center; width: 100%; display: flex; justify-content: center; }
    .sidebar-label { display: none; }
    .sidebar-link { justify-content: center; gap: 0; padding: 10px; }
    .sidebar-footer { display: none; }
  }

  @media (min-width: 1024px) {
    .sidebar {
      display: flex;
      width: 180px;
      padding: 24px 16px 20px;
      align-items: stretch;
    }
    .sidebar-logo { display: block; height: 14px; width: auto; opacity: 0.4; }
    .sidebar-icon { display: none; }
    .sidebar-label { display: inline; }
    .sidebar-link { justify-content: flex-start; gap: 10px; padding: 9px 12px; }
    .sidebar-footer { display: block; }
  }

  .sidebar-brand { padding: 0 4px 28px; }
  .sidebar-logo { display: none; }
  .sidebar-icon { display: none; }

  .sidebar-nav {
    display: flex; flex-direction: column;
    flex: 1; min-height: 0; gap: 2px;
  }

  .sidebar-link {
    display: flex; align-items: center; gap: 10px;
    padding: 9px 12px; border-radius: 10px;
    text-decoration: none;
    color: #4A4A50;
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 13px; font-weight: 500;
    transition: color 0.15s ease, background 0.15s ease;
    border: 1px solid transparent;
  }

  .sidebar-link:hover {
    color: #8A8A90;
    background: rgba(255,255,255,0.02);
  }

  .sidebar-link--active {
    color: #E8833A;
    background: rgba(232,131,58,0.06);
    border-color: rgba(232,131,58,0.1);
  }

  .sidebar-footer {
    margin-top: auto;
    padding: 16px 4px 0;
  }

  .sidebar-footer-link {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px; color: #2A2A30;
    text-decoration: none; letter-spacing: 0.04em;
  }

  .sidebar-footer-link:hover {
    color: #4A4A50;
  }
</style>
