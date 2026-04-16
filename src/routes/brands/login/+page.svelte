<script lang="ts">
  import { page } from '$app/stores';
  import InstagramLogo from 'phosphor-svelte/lib/InstagramLogo';

  $: errorMsg = $page.url.searchParams.get('error') || '';
</script>

<div class="login-page">
  <div class="login-bg" aria-hidden="true"></div>

  <div class="login-card">
    <p class="overline">Brand Portal</p>
    <h1 class="title">Connect your Instagram</h1>
    <p class="description">
      Sign in with your brand's Instagram account to start scheduling posts, generating captions, and automating your content.
    </p>

    {#if errorMsg}
      <p class="error">{errorMsg === 'not_configured' ? 'Instagram not configured on this server.' : `Authentication failed: ${errorMsg}`}</p>
    {/if}

    <a href="/auth/brand-instagram" class="ig-btn">
      <InstagramLogo size={20} weight="bold" />
      Continue with Instagram
    </a>

    <div class="footer-links">
      <a href="/brands" class="footer-link">&larr; Brand home</a>
      <span class="footer-sep">&middot;</span>
      <a href="/" class="footer-link">Creator app</a>
    </div>
  </div>
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

  .login-bg {
    position: absolute; inset: 0; pointer-events: none;
    background: radial-gradient(ellipse 70% 45% at 50% 0%, rgba(77, 124, 255, 0.06), transparent 70%);
  }

  .login-card {
    position: relative; z-index: 1; width: 100%; max-width: 26rem;
    padding: 2rem; border-radius: 1.25rem;
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--glass-light, rgba(255, 255, 255, 0.055));
    backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.06), 0 24px 64px rgba(0, 0, 0, 0.4);
  }

  .overline {
    font-size: 0.6875rem; font-weight: 600; text-transform: uppercase;
    letter-spacing: 0.24em; color: var(--text-muted, #6d7684); margin: 0;
  }
  .title {
    margin: 0.75rem 0 0; font-size: 1.5rem; font-weight: 600;
    color: var(--text-primary, #e8ecf3);
  }
  .description {
    margin-top: 0.5rem; font-size: 0.875rem; line-height: 1.6;
    color: var(--text-muted, #6d7684);
  }
  .error {
    margin-top: 1rem; font-size: 0.875rem;
    color: var(--state-error, var(--accent-primary, #FF4D4D));
  }

  .ig-btn {
    display: flex; align-items: center; justify-content: center; gap: 0.625rem;
    width: 100%; margin-top: 2rem; padding: 0.875rem;
    border: none; border-radius: 0.75rem;
    font-size: 0.9375rem; font-weight: 600;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    color: #fff; text-decoration: none;
    background: linear-gradient(135deg, #F58529, #DD2A7B, #8134AF, #515BD4);
    cursor: pointer; transition: all 0.25s;
  }
  .ig-btn:hover {
    box-shadow: 0 0 32px rgba(221, 42, 123, 0.3);
    transform: translateY(-1px);
  }

  .footer-links {
    margin-top: 2rem; text-align: center; font-size: 0.75rem;
  }
  .footer-link {
    color: var(--text-muted, #6d7684); text-decoration: none; transition: color 0.2s;
  }
  .footer-link:hover { color: var(--text-primary, #e8ecf3); }
  .footer-sep { margin: 0 0.5rem; color: var(--border-strong, rgba(255, 255, 255, 0.14)); }
</style>
