<script lang="ts">
</script>

<div class="landing">
  <!-- Hero -->
  <section class="hero">
    <div class="hero-bg" aria-hidden="true"></div>
    <p class="overline">Audience-first matching</p>
    <h1 class="headline">
      Find your exact audience.<br />
      <span class="headline-accent">Not just followers.</span>
    </h1>
    <p class="subline">
      Describe who you need in plain language. We match you to portrait-verified creators whose audiences actually align — by signal, not spreadsheet.
    </p>
    <div class="hero-actions">
      <a href="/brands/portal" class="cta-primary">
        Start matching
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M3 8h10m-4-4 4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </a>
    </div>
  </section>

  <!-- Features -->
  <section class="features">
    <div class="features-inner">
      <div class="process-step">
        <span class="step-num">01</span>
        <h2 class="step-title">Describe</h2>
        <p class="step-desc">Tell us who you want to reach in plain language. Not demographics — identity.</p>
      </div>
      <div class="process-arrow" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="process-step">
        <span class="step-num">02</span>
        <h2 class="step-title">Discover</h2>
        <p class="step-desc">We match your brief against verified creator portraits — by signal, not spreadsheet.</p>
      </div>
      <div class="process-arrow" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M5 12h14M14 7l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
      <div class="process-step">
        <span class="step-num">03</span>
        <h2 class="step-title">Deploy</h2>
        <p class="step-desc">Launch your campaign to matched creators. In-app, email, WhatsApp — they see your brief.</p>
      </div>
    </div>
  </section>
</div>

<style>
  .landing {
    position: relative;
  }

  /* ---- Hero ---- */
  .hero {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: calc(100vh - 56px);
    padding: 3rem 1rem 6rem;
    text-align: center;
  }

  .hero-bg {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(
      ellipse 70% 50% at 50% 0%,
      rgba(255, 77, 77, 0.06),
      transparent 70%
    );
  }

  .overline {
    position: relative;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.24em;
    color: var(--text-muted, #6d7684);
    margin-bottom: 1.5rem;
  }

  .headline {
    position: relative;
    max-width: 48rem;
    font-size: clamp(2rem, 5vw, 3.5rem);
    font-weight: 600;
    line-height: 1.08;
    letter-spacing: -0.02em;
    color: var(--text-primary, #e8ecf3);
  }

  .headline-accent {
    display: block;
    color: var(--text-secondary, #9aa3b2);
  }

  .subline {
    position: relative;
    max-width: 36rem;
    margin-top: 1.5rem;
    font-size: 1rem;
    line-height: 1.7;
    color: var(--text-muted, #6d7684);
  }

  @media (min-width: 768px) {
    .subline {
      font-size: 1.125rem;
    }
  }

  .hero-actions {
    position: relative;
    margin-top: 3rem;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 1rem;
  }

  .cta-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.875rem 2rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #fff;
    text-decoration: none;
    background: linear-gradient(135deg, var(--accent-primary, #FF4D4D), var(--accent-tertiary, #FFB84D));
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
    transition: all 0.25s;
  }

  .cta-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  }

  /* ---- Features ---- */
  .features {
    border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--bg-secondary, oklch(10% 0.009 255));
    padding: 4rem 1rem;
  }

  .features-inner {
    max-width: 56rem;
    margin: 0 auto;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: 2rem;
  }

  .process-step {
    flex: 1;
    max-width: 16rem;
  }

  .process-arrow {
    color: var(--text-muted, #6d7684);
    flex-shrink: 0;
    margin-top: 1.5rem;
    display: none;
  }

  @media (min-width: 768px) {
    .process-arrow { display: block; }
    .features-inner { gap: 1.5rem; }
  }

  @media (max-width: 767px) {
    .features-inner { flex-direction: column; align-items: center; }
  }

  .step-num {
    font-size: 0.6875rem;
    font-weight: 700;
    font-family: var(--font-mono, 'Geist Mono', monospace);
    color: var(--accent-secondary, #4D7CFF);
    letter-spacing: 0.06em;
  }

  .step-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--text-primary, #e8ecf3);
    margin: 0.5rem 0 0;
  }

  .step-desc {
    font-size: 0.875rem;
    line-height: 1.65;
    color: var(--text-muted, #6d7684);
    margin: 0.5rem 0 0;
  }
</style>
