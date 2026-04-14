<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  let portalSecret = '';
  let err = '';
  let loading = false;

  function safeNextPath(raw: string | null): string {
    if (raw == null || typeof raw !== 'string') return '/brands/portal';
    const t = raw.trim();
    if (!t.startsWith('/') || t.startsWith('//')) return '/brands/portal';
    return t;
  }

  async function submit() {
    err = '';
    loading = true;
    try {
      const res = await fetch('/api/brands/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portalSecret }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        err = (j as { message?: string }).message || (j as { error?: string }).error || 'Authentication failed';
        return;
      }
      const next = safeNextPath($page.url.searchParams.get('next'));
      await goto(next, { replaceState: true });
    } finally {
      loading = false;
    }
  }
</script>

<div class="login-page">
  <div class="login-bg" aria-hidden="true"></div>

  <div class="login-card">
    <p class="overline">Operator</p>
    <h1 class="title">Brand access</h1>
    <p class="description">
      Enter your portal key to launch campaigns. Audience exploration is free.
    </p>

    <form class="login-form" on:submit|preventDefault={() => submit()}>
      <div class="field">
        <label for="portal-key" class="label">Portal key</label>
        <input
          id="portal-key"
          type="password"
          autocomplete="current-password"
          class="input"
          bind:value={portalSecret}
          required
        />
      </div>

      {#if err}
        <p class="error">{err}</p>
      {/if}

      <button type="submit" disabled={loading} class="submit-btn">
        {loading ? 'Connecting...' : 'Continue'}
        {#if !loading}
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        {/if}
      </button>
    </form>

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
    border-radius: 1rem;
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--bg-elevated, oklch(13% 0.010 258));
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.4);
  }

  .overline {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.24em;
    color: var(--text-muted, #6d7684);
    margin: 0;
  }

  .title {
    margin: 0.75rem 0 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary, #e8ecf3);
  }

  .description {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.6;
    color: var(--text-muted, #6d7684);
  }

  .login-form {
    margin-top: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .label {
    font-size: 0.75rem;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted, #6d7684);
  }

  .input {
    width: 100%;
    padding: 0.75rem 1rem;
    border-radius: 0.75rem;
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--bg-primary, oklch(8% 0.008 260));
    color: var(--text-primary, #e8ecf3);
    font-size: 0.875rem;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    outline: none;
    transition: border-color 0.2s;
    box-sizing: border-box;
  }

  .input:focus {
    border-color: var(--accent-secondary, #4D7CFF);
    box-shadow: 0 0 0 3px rgba(77, 124, 255, 0.15);
  }

  .error {
    font-size: 0.875rem;
    color: var(--state-error, var(--accent-primary, #FF4D4D));
    margin: 0;
  }

  .submit-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.75rem;
    border: none;
    border-radius: 0.75rem;
    font-size: 0.875rem;
    font-weight: 600;
    font-family: var(--font-sans, 'Geist', system-ui, sans-serif);
    color: #fff;
    background: linear-gradient(135deg, var(--accent-primary, #FF4D4D), var(--accent-tertiary, #FFB84D));
    cursor: pointer;
    transition: all 0.25s;
  }

  .submit-btn:hover:not(:disabled) {
    box-shadow: 0 0 32px rgba(255, 77, 77, 0.25);
    transform: translateY(-1px);
  }

  .submit-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .footer-links {
    margin-top: 2rem;
    text-align: center;
    font-size: 0.75rem;
  }

  .footer-link {
    color: var(--text-muted, #6d7684);
    text-decoration: none;
    transition: color 0.2s;
  }

  .footer-link:hover {
    color: var(--text-primary, #e8ecf3);
  }

  .footer-sep {
    margin: 0 0.5rem;
    color: var(--border-strong, rgba(255, 255, 255, 0.14));
  }
</style>
