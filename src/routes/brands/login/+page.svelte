<script lang="ts">
  import { resolve } from '$app/paths';
  import { page } from '$app/stores';
  import InstagramLogo from 'phosphor-svelte/lib/InstagramLogo';
  import Briefcase from 'phosphor-svelte/lib/Briefcase';
  import CheckCircle from 'phosphor-svelte/lib/CheckCircle';
  import MagnetStraight from 'phosphor-svelte/lib/MagnetStraight';

  $: errorMsg = $page.url.searchParams.get('error') || '';
</script>

<div class="login-page">
  <div class="login-orb login-orb--lime" aria-hidden="true"></div>
  <div class="login-orb login-orb--magenta" aria-hidden="true"></div>
  <div class="login-grain" aria-hidden="true"></div>

  <section class="login-shell" aria-labelledby="brand-login-title">
    <div class="login-copy">
      <p class="overline">
        <Briefcase size={14} weight="fill" />
        Brand distribution access
      </p>
      <h1 id="brand-login-title">Connect your brand Instagram.</h1>
      <p class="description">
        Enter the brand portal to find culture-fit creators, send structured briefs, track proof,
        and turn campaign activity into operating intelligence.
      </p>

      <div class="proof-grid" aria-label="Brand portal capabilities">
        <span><MagnetStraight size={16} weight="fill" /> Creator discovery</span>
        <span><CheckCircle size={16} weight="fill" /> Approval pipeline</span>
        <span><Briefcase size={16} weight="fill" /> Campaign receipts</span>
      </div>
    </div>

    <div class="login-card">
      <p class="overline">Brand Portal</p>
      <h2>Brand sign-in</h2>
      <p class="description">
        Use the Instagram account that represents your brand. Creator onboarding uses a separate
        flow.
      </p>
      {#if errorMsg}
        <p class="error">
          {errorMsg === 'not_configured'
            ? 'Instagram not configured on this server.'
            : `Authentication failed: ${errorMsg}`}
        </p>
      {/if}

      <a href={resolve('/auth/brand-instagram')} class="ig-btn">
        <InstagramLogo size={20} weight="bold" />
        Connect brand Instagram
      </a>

      <div class="footer-links">
        <a href={resolve('/')} class="footer-link">&larr; Distribution hub</a>
        <span class="footer-sep">&middot;</span>
        <a href={resolve('/brands')} class="footer-link">Brand OS</a>
      </div>
    </div>
  </section>
</div>

<style>
  .login-page {
    position: relative;
    min-height: 100svh;
    overflow: hidden;
    background:
      radial-gradient(circle at 72% 16%, rgba(153, 36, 96, 0.34), transparent 42%),
      radial-gradient(circle at 18% 82%, rgba(196, 242, 74, 0.12), transparent 34%),
      linear-gradient(145deg, #030306 0%, #0b0710 48%, #1b0817 100%);
    color: oklch(96% 0.018 88);
    font-family: var(--font-sans);
  }

  .login-shell {
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: minmax(0, 0.92fr) minmax(320px, 420px);
    align-items: center;
    gap: clamp(2rem, 6vw, 5rem);
    width: min(100%, 1080px);
    min-height: 100svh;
    margin: 0 auto;
    padding: clamp(1.25rem, 5vw, 3rem);
  }

  .login-orb,
  .login-grain {
    position: absolute;
    pointer-events: none;
  }

  .login-orb {
    width: 42vw;
    height: 42vw;
    min-width: 320px;
    min-height: 320px;
    border-radius: 999px;
    filter: blur(60px);
    opacity: 0.44;
  }

  .login-orb--lime {
    left: -12vw;
    bottom: -18vw;
    background: rgba(196, 242, 74, 0.22);
  }

  .login-orb--magenta {
    right: -10vw;
    top: -12vw;
    background: rgba(255, 45, 126, 0.32);
  }

  .login-grain {
    inset: 0;
    z-index: 1;
    opacity: 0.16;
    mix-blend-mode: soft-light;
    background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 100% 4px;
  }

  .login-copy h1 {
    max-width: 9ch;
    margin: 0.8rem 0 1rem;
    font-family: var(--font-display);
    font-size: clamp(3.6rem, 8vw, 7rem);
    font-weight: 600;
    letter-spacing: -0.085em;
    line-height: 0.86;
  }

  .login-card {
    border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 34px;
    padding: clamp(1.5rem, 4vw, 2rem);
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.045)),
      rgba(20, 18, 23, 0.72);
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.08),
      0 28px 80px rgba(0, 0, 0, 0.34);
    backdrop-filter: blur(28px);
  }

  .overline {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    color: #9cec7b;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    margin: 0;
  }

  .login-card h2 {
    margin: 0.8rem 0 0.5rem;
    font-size: clamp(1.8rem, 4vw, 2.6rem);
    letter-spacing: -0.06em;
    line-height: 1;
  }

  .description {
    margin-top: 0.5rem;
    line-height: 1.6;
    color: rgba(255, 248, 232, 0.72);
  }

  .proof-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 0.75rem;
    max-width: 640px;
    margin-top: 2rem;
  }

  .proof-grid span {
    min-height: 44px;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 999px;
    padding: 0 0.85rem;
    background: rgba(255, 255, 255, 0.06);
    color: rgba(255, 248, 232, 0.84);
    font-size: 0.82rem;
    font-weight: 800;
  }

  .error {
    margin-top: 1rem;
    font-size: 0.875rem;
    color: #ff8d9d;
  }

  .ig-btn {
    min-height: 48px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.65rem;
    width: 100%;
    margin-top: 2rem;
    border-radius: 999px;
    background: #c4f24a;
    color: #10120a;
    font-weight: 900;
    text-decoration: none;
    box-shadow: 0 16px 36px rgba(196, 242, 74, 0.24);
    transition:
      transform 220ms var(--ease-premium),
      box-shadow 220ms var(--ease-premium),
      background 220ms var(--ease-premium);
  }

  .ig-btn:hover {
    transform: translateY(-2px);
    background: #d6ff64;
    box-shadow: 0 20px 44px rgba(196, 242, 74, 0.32);
  }

  .footer-links {
    margin-top: 2rem;
    text-align: center;
    font-size: 0.75rem;
  }

  .footer-link {
    color: rgba(255, 248, 232, 0.62);
    text-decoration: none;
    transition: color 0.2s;
  }

  .footer-link:hover {
    color: rgba(255, 248, 232, 0.92);
  }

  .footer-sep {
    margin: 0 0.5rem;
    color: rgba(255, 255, 255, 0.18);
  }

  @media (max-width: 767px) {
    .login-page {
      overflow-y: auto;
    }

    .login-shell {
      grid-template-columns: 1fr;
      align-content: center;
    }

    .login-copy h1 {
      max-width: 10ch;
      font-size: clamp(3.2rem, 17vw, 4.8rem);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .login-page *,
    .login-page *::before,
    .login-page *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
    }
  }
</style>
