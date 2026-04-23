<script lang="ts">
  import { page } from '$app/stores';
  import InstagramLogo from 'phosphor-svelte/lib/InstagramLogo';
  import OsPageShell from '$lib/components/os/OsPageShell.svelte';
  import OsCard from '$lib/components/os/OsCard.svelte';
  import OsButton from '$lib/components/os/OsButton.svelte';

  $: errorMsg = $page.url.searchParams.get('error') || '';
</script>

<div class="login-page">
  <div class="login-bg" aria-hidden="true"></div>
  <OsPageShell as="section" className="login-shell">
    <OsCard raised={true} className="login-card">
      <p class="overline">Brand Portal</p>
      <h1 class="title">Connect your Instagram</h1>
      <p class="description">
        Sign in with your brand's Instagram account to start scheduling posts, generating captions,
        and automating your content.
      </p>

      {#if errorMsg}
        <p class="error">
          {errorMsg === 'not_configured'
            ? 'Instagram not configured on this server.'
            : `Authentication failed: ${errorMsg}`}
        </p>
      {/if}

      <a href="/auth/brand-instagram" class="ig-btn">
        <OsButton variant="primary" className="ig-btn-inner">
          <InstagramLogo size={20} weight="bold" />
          Continue with Instagram
        </OsButton>
      </a>

      <div class="footer-links">
        <a href="/brands" class="footer-link">&larr; Brand home</a>
        <span class="footer-sep">&middot;</span>
        <a href="/" class="footer-link">Creator app</a>
      </div>
    </OsCard>
  </OsPageShell>
</div>

<style>
  .login-page {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 56px);
    padding: 2rem 1rem;
  }

  .login-shell {
    display: grid;
    place-items: center;
    min-height: calc(100vh - 56px);
  }

  .login-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      ellipse 70% 45% at 50% 0%,
      rgba(77, 124, 255, 0.06),
      transparent 70%
    );
  }

  .login-card {
    position: relative;
    z-index: 1;
    width: 100%;
    max-width: 26rem;
    padding: 2rem;
    box-shadow:
      inset 0 1px 1px rgba(255, 255, 255, 0.06),
      0 24px 64px rgba(0, 0, 0, 0.4);
  }

  .overline {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.24em;
    color: var(--g-text-3, #4a4a50);
    margin: 0;
  }
  .title {
    margin: 0.75rem 0 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--g-text, #ededef);
  }
  .description {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--g-text-3, #4a4a50);
  }
  .error {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: var(--g-accent, #e8464a);
  }

  .ig-btn {
    display: block;
    width: 100%;
    margin-top: 2rem;
    text-decoration: none;
  }
  .ig-btn-inner {
    width: 100%;
    min-height: 44px;
  }

  .footer-links {
    margin-top: 2rem;
    text-align: center;
    font-size: 0.75rem;
  }
  .footer-link {
    color: var(--g-text-3, #4a4a50);
    text-decoration: none;
    transition: color 0.2s;
  }
  .footer-link:hover {
    color: var(--g-text, #ededef);
  }
  .footer-sep {
    margin: 0 0.5rem;
    color: var(--g-border-strong, rgba(255, 255, 255, 0.14));
  }
</style>
