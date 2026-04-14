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
      <div class="feature-card">
        <div class="feature-icon feature-icon--red" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="3" stroke="currentColor" stroke-width="1.5" />
            <path d="M10 2v3m0 10v3M2 10h3m10 0h3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
          </svg>
        </div>
        <h2 class="feature-title">Audience-first matching</h2>
        <p class="feature-desc">
          Describe your ideal audience in a sentence. We map it to real identity signals — not checkbox demographics.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon feature-icon--blue" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <rect x="3" y="5" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.5" />
            <circle cx="10" cy="10" r="2" stroke="currentColor" stroke-width="1.5" />
          </svg>
        </div>
        <h2 class="feature-title">Portrait-verified creators</h2>
        <p class="feature-desc">
          Every match is a real person with verified identity. See the creator, not just a row of anonymous IDs.
        </p>
      </div>

      <div class="feature-card">
        <div class="feature-icon feature-icon--gold" aria-hidden="true">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M4 16l2-6L10 4l4 6 2 6H4z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" />
            <circle cx="10" cy="12" r="1.5" fill="currentColor" />
          </svg>
        </div>
        <h2 class="feature-title">Conversational briefs</h2>
        <p class="feature-desc">
          Build campaign briefs through conversation, not forms. When you are ready, push to channels — in-app, email, more to come.
        </p>
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
    background: linear-gradient(
      to right,
      var(--text-secondary, #9aa3b2),
      var(--text-primary, #e8ecf3),
      var(--text-secondary, #9aa3b2)
    );
    -webkit-background-clip: text;
    background-clip: text;
    -webkit-text-fill-color: transparent;
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
    box-shadow: 0 0 32px rgba(255, 77, 77, 0.2);
    transition: all 0.25s;
  }

  .cta-primary:hover {
    transform: translateY(-1px);
    box-shadow: 0 0 48px rgba(255, 77, 77, 0.3);
  }

  /* ---- Features ---- */
  .features {
    border-top: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--bg-secondary, oklch(10% 0.009 255));
    padding: 4rem 1rem;
  }

  .features-inner {
    max-width: 60rem;
    margin: 0 auto;
    display: grid;
    gap: 1.5rem;
  }

  @media (min-width: 768px) {
    .features-inner {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .feature-card {
    padding: 1.75rem;
    border-radius: 1rem;
    border: 1px solid var(--border-subtle, rgba(255, 255, 255, 0.08));
    background: var(--glass-light, rgba(255, 255, 255, 0.055));
    transition: border-color 0.25s;
  }

  .feature-card:hover {
    border-color: var(--border-strong, rgba(255, 255, 255, 0.14));
  }

  .feature-icon {
    width: 2.25rem;
    height: 2.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 0.5rem;
    margin-bottom: 1rem;
  }

  .feature-icon--red {
    color: var(--accent-primary, #FF4D4D);
    background: rgba(255, 77, 77, 0.1);
  }

  .feature-icon--blue {
    color: var(--accent-secondary, #4D7CFF);
    background: rgba(77, 124, 255, 0.1);
  }

  .feature-icon--gold {
    color: var(--accent-tertiary, #FFB84D);
    background: rgba(255, 184, 77, 0.1);
  }

  .feature-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--text-primary, #e8ecf3);
    margin: 0;
  }

  .feature-desc {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    line-height: 1.65;
    color: var(--text-muted, #6d7684);
  }
</style>
