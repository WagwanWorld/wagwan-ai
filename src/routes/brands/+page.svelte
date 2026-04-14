<script lang="ts">
  import { onMount } from 'svelte';

  let visible = false;
  onMount(() => { setTimeout(() => { visible = true; }, 60); });
</script>

<div class="landing" class:visible>

  <!-- ═══ HERO ═══ -->
  <section class="hero">
    <div class="hero-glow" aria-hidden="true"></div>

    <div class="hero-split">
      <div class="hero-left">
        <div class="eyebrow-pill">Audience Intelligence</div>
        <h1 class="h1">
          Stop guessing.<br/>
          Start reaching the<br/>
          <span class="h1-accent">right people.</span>
        </h1>
        <p class="hero-sub">
          Describe your ideal customer in a sentence. Our AI matches you to verified
          micro-creators whose audiences actually look like your buyers.
        </p>
        <div class="hero-ctas">
          <a href="/brands/portal" class="btn-primary">
            <span>Start matching</span>
            <span class="btn-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </a>
          <a href="#how" class="btn-ghost">See how it works</a>
        </div>
      </div>

      <div class="hero-right">
        <div class="preview-shell">
          <div class="preview-inner">
            <div class="preview-bar">
              <span class="preview-dot"></span>
              <span class="preview-dot"></span>
              <span class="preview-dot"></span>
            </div>
            <div class="preview-chat">
              <p class="preview-msg preview-msg--agent">Tell me about what you're trying to sell and who buys it.</p>
              <p class="preview-msg preview-msg--user">We make developer tools for early-stage founders building their first SaaS.</p>
              <p class="preview-msg preview-msg--agent">Got it. What makes a founder choose you over just hacking something together?</p>
            </div>
            <div class="preview-result">
              <div class="preview-result-header">
                <span class="preview-result-badge">92</span>
                <span class="preview-result-name">Arjun Mehta</span>
              </div>
              <span class="preview-result-meta">Builder archetype · 8.2k followers · Mumbai</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══ BRAND MARQUEE ═══ -->
  <section class="marquee-section">
    <p class="marquee-label">Trusted by teams who care about reach quality</p>
    <div class="marquee-track">
      <div class="marquee-scroll">
        {#each ['Razorpay', 'Zerodha', 'CRED', 'Meesho', 'PhonePe', 'Swiggy', 'Zomato', 'Freshworks', 'Postman', 'Chargebee', 'Razorpay', 'Zerodha', 'CRED', 'Meesho', 'PhonePe', 'Swiggy'] as brand}
          <span class="marquee-brand">{brand}</span>
        {/each}
      </div>
    </div>
  </section>

  <!-- ═══ STATS ═══ -->
  <section class="stats">
    <div class="stats-inner">
      <div class="stat">
        <span class="stat-num">3.2x</span>
        <span class="stat-label">Higher conversion vs. traditional influencer outreach</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-num">847</span>
        <span class="stat-label">Portrait-verified creators in the network</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-num">92%</span>
        <span class="stat-label">Brand brief acceptance rate from matched creators</span>
      </div>
    </div>
  </section>

  <!-- ═══ BENTO SHOWCASE ═══ -->
  <section class="bento" id="how">
    <div class="bento-header">
      <div class="eyebrow-pill">How it works</div>
      <h2 class="h2">Not a database.<br/>An intelligence layer.</h2>
    </div>

    <div class="bento-grid">
      <div class="bento-card bento-card--wide">
        <span class="bento-num">01</span>
        <h3 class="bento-title">You describe the audience. Not the creator.</h3>
        <p class="bento-desc">
          "Founders building in fintech, early-stage, who read Paul Graham and ship weekly."
          Our AI parses intent, not keywords. It understands buyer identity, not just demographics.
        </p>
      </div>

      <div class="bento-card">
        <span class="bento-num">02</span>
        <h3 class="bento-title">We score on signal depth</h3>
        <p class="bento-desc">
          Every creator has a verified identity portrait built from real platform data — Instagram, Spotify, Google, LinkedIn. We match on who their audience actually is.
        </p>
      </div>

      <div class="bento-card">
        <span class="bento-num">03</span>
        <h3 class="bento-title">You deploy in one click</h3>
        <p class="bento-desc">
          Launch campaigns to matched creators. They see your brief, set their rates, and accept. WhatsApp, in-app, email — their choice.
        </p>
      </div>

      <div class="bento-card bento-card--wide">
        <div class="bento-visual">
          <div class="bento-score-ring">
            <svg viewBox="0 0 80 80" width="80" height="80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--glass-medium)" stroke-width="4"/>
              <circle cx="40" cy="40" r="34" fill="none" stroke="var(--accent-secondary)" stroke-width="4" stroke-dasharray="178 214" stroke-linecap="round" transform="rotate(-90 40 40)"/>
              <text x="40" y="43" text-anchor="middle" fill="var(--text-primary)" font-size="18" font-weight="800" font-family="var(--font-mono)">83</text>
            </svg>
            <span class="bento-score-label">Audience match</span>
          </div>
          <div class="bento-tags">
            <span class="bento-tag bento-tag--red">Founder</span>
            <span class="bento-tag bento-tag--blue">SaaS</span>
            <span class="bento-tag bento-tag--gold">Fintech</span>
            <span class="bento-tag bento-tag--blue">Builder</span>
          </div>
        </div>
        <h3 class="bento-title">Portrait-level precision</h3>
        <p class="bento-desc">
          Not "25-35 male interested in tech." We know they're a Builder-dominant founder, shipping 3x/week,
          with an audience of CTOs and early employees. That's a profile worth paying for.
        </p>
      </div>
    </div>
  </section>

  <!-- ═══ TESTIMONIALS ═══ -->
  <section class="testimonials">
    <div class="eyebrow-pill">What brands say</div>
    <div class="testimonial-grid">
      <div class="testimonial-card">
        <p class="testimonial-text">
          "We spent ₹3L on influencer campaigns last quarter with mediocre results. One Wagwan-matched
          creator drove more signups in a week than the entire previous batch."
        </p>
        <div class="testimonial-author">
          <div class="testimonial-avatar">RK</div>
          <div>
            <span class="testimonial-name">Rishi Kapoor</span>
            <span class="testimonial-role">Head of Growth, Tooljet</span>
          </div>
        </div>
      </div>

      <div class="testimonial-card">
        <p class="testimonial-text">
          "The AI matching agent understood our ICP better than our own brief did. It asked questions
          our team hadn't thought to ask. The shortlist was surgical."
        </p>
        <div class="testimonial-author">
          <div class="testimonial-avatar">PS</div>
          <div>
            <span class="testimonial-name">Priya Sharma</span>
            <span class="testimonial-role">Marketing Lead, Dukaan</span>
          </div>
        </div>
      </div>

      <div class="testimonial-card">
        <p class="testimonial-text">
          "We stopped paying for reach and started paying for relevance. 8k followers that are
          all founders is worth more than 200k random consumers."
        </p>
        <div class="testimonial-author">
          <div class="testimonial-avatar">AV</div>
          <div>
            <span class="testimonial-name">Ankit Verma</span>
            <span class="testimonial-role">CEO, Hyperstack</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- ═══ FINAL CTA ═══ -->
  <section class="final-cta">
    <div class="final-glow" aria-hidden="true"></div>
    <h2 class="h2">Your audience exists.<br/>We know where they are.</h2>
    <p class="final-sub">No spreadsheets. No cold DMs. Just describe who you need.</p>
    <a href="/brands/portal" class="btn-primary btn-primary--lg">
      <span>Find your audience</span>
      <span class="btn-icon">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
      </span>
    </a>
  </section>
</div>

<style>
  /* ── Base ── */
  .landing {
    opacity: 0;
    transform: translateY(8px);
    transition: opacity 0.6s cubic-bezier(0.32, 0.72, 0, 1), transform 0.6s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .landing.visible {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── Shared ── */
  .eyebrow-pill {
    display: inline-block;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--text-muted);
    border: 1px solid var(--border-subtle);
    border-radius: 9999px;
    padding: 0.375rem 1rem;
    margin-bottom: 1.5rem;
  }

  .h1 {
    font-size: clamp(2.25rem, 5.5vw, 4rem);
    font-weight: 600;
    line-height: 1.06;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin: 0;
  }

  .h1-accent {
    color: var(--text-muted);
  }

  .h2 {
    font-size: clamp(1.75rem, 4vw, 2.75rem);
    font-weight: 600;
    line-height: 1.1;
    letter-spacing: -0.02em;
    color: var(--text-primary);
    margin: 0;
  }

  /* ── Buttons ── */
  .btn-primary {
    display: inline-flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.875rem 1.25rem 0.875rem 1.5rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    font-weight: 600;
    color: #fff;
    text-decoration: none;
    background: var(--accent-primary);
    transition: all 0.5s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .btn-primary:hover { transform: translateY(-1px); }
  .btn-primary:active { transform: scale(0.98); }
  .btn-primary--lg { padding: 1rem 1.5rem 1rem 2rem; font-size: 1rem; }

  .btn-icon {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    background: rgba(255,255,255,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .btn-primary:hover .btn-icon { transform: translateX(2px); }

  .btn-ghost {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-muted);
    text-decoration: none;
    padding: 0.875rem 1.5rem;
    border-radius: 9999px;
    border: 1px solid var(--border-subtle);
    transition: all 0.3s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .btn-ghost:hover {
    color: var(--text-primary);
    border-color: var(--border-strong);
  }

  /* ═══ HERO ═══ */
  .hero {
    position: relative;
    padding: 6rem 1.5rem 4rem;
    overflow: hidden;
  }

  .hero-glow {
    position: absolute;
    width: 600px;
    height: 600px;
    top: -200px;
    right: -100px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(77, 124, 255, 0.08), transparent 70%);
    pointer-events: none;
  }

  .hero-split {
    max-width: 72rem;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 3rem;
    align-items: center;
  }

  @media (min-width: 1024px) {
    .hero-split {
      grid-template-columns: 1fr 1fr;
      gap: 4rem;
    }
    .hero { padding: 8rem 2rem 6rem; }
  }

  .hero-left { position: relative; }

  .hero-sub {
    margin: 1.5rem 0 0;
    font-size: 1rem;
    line-height: 1.7;
    color: var(--text-muted);
    max-width: 28rem;
  }

  .hero-ctas {
    margin-top: 2.5rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    align-items: center;
  }

  /* ── Preview mock ── */
  .preview-shell {
    border-radius: 1.25rem;
    padding: 3px;
    background: linear-gradient(135deg, rgba(77,124,255,0.2), rgba(255,77,77,0.15), rgba(255,184,77,0.1));
  }

  .preview-inner {
    border-radius: calc(1.25rem - 3px);
    background: var(--bg-secondary);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.04), 0 8px 32px rgba(0,0,0,0.3);
    padding: 0;
    overflow: hidden;
  }

  .preview-bar {
    display: flex;
    gap: 6px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border-subtle);
  }

  .preview-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--glass-medium);
  }

  .preview-chat {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .preview-msg {
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
    padding: 10px 14px;
    border-radius: 12px;
    max-width: 88%;
  }

  .preview-msg--agent {
    background: var(--glass-light);
    color: var(--text-secondary);
    align-self: flex-start;
  }

  .preview-msg--user {
    background: rgba(255,77,77,0.08);
    border: 1px solid rgba(255,77,77,0.12);
    color: var(--text-primary);
    align-self: flex-end;
  }

  .preview-result {
    margin: 0 16px 16px;
    padding: 12px;
    border-radius: 10px;
    border: 1px solid rgba(77,124,255,0.2);
    background: rgba(77,124,255,0.04);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .preview-result-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .preview-result-badge {
    font-size: 0.6875rem;
    font-weight: 800;
    font-family: var(--font-mono);
    color: var(--accent-secondary);
    background: rgba(77,124,255,0.12);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .preview-result-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .preview-result-meta {
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  /* ═══ MARQUEE ═══ */
  .marquee-section {
    padding: 3rem 0;
    border-top: 1px solid var(--border-subtle);
    border-bottom: 1px solid var(--border-subtle);
    overflow: hidden;
  }

  .marquee-label {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: var(--text-muted);
    text-align: center;
    margin: 0 0 1.5rem;
  }

  .marquee-track {
    position: relative;
    mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
    -webkit-mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
  }

  .marquee-scroll {
    display: flex;
    gap: 3.5rem;
    animation: marquee 30s linear infinite;
    width: max-content;
  }

  .marquee-brand {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--text-muted);
    white-space: nowrap;
    opacity: 0.5;
    transition: opacity 0.3s;
  }
  .marquee-brand:hover { opacity: 1; }

  @keyframes marquee {
    0% { transform: translateX(0); }
    100% { transform: translateX(-50%); }
  }

  /* ═══ STATS ═══ */
  .stats {
    padding: 4rem 1.5rem;
  }

  .stats-inner {
    max-width: 56rem;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 3rem;
  }

  @media (max-width: 767px) {
    .stats-inner { flex-direction: column; gap: 2rem; }
    .stat-divider { display: none; }
  }

  .stat {
    text-align: center;
  }

  .stat-num {
    display: block;
    font-size: clamp(2rem, 4vw, 3rem);
    font-weight: 700;
    font-family: var(--font-mono);
    letter-spacing: -0.03em;
    color: var(--text-primary);
  }

  .stat-label {
    display: block;
    font-size: 0.8125rem;
    color: var(--text-muted);
    margin-top: 0.5rem;
    max-width: 14rem;
    line-height: 1.4;
  }

  .stat-divider {
    width: 1px;
    height: 3rem;
    background: var(--border-subtle);
    flex-shrink: 0;
  }

  /* ═══ BENTO ═══ */
  .bento {
    padding: 6rem 1.5rem;
    scroll-margin-top: 4rem;
  }

  .bento-header {
    text-align: center;
    margin-bottom: 3rem;
  }

  .bento-grid {
    max-width: 56rem;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .bento-grid {
      grid-template-columns: repeat(2, 1fr);
    }
    .bento-card--wide {
      grid-column: span 2;
    }
  }

  .bento-card {
    padding: 2rem;
    border-radius: 1.25rem;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.04);
    transition: border-color 0.4s cubic-bezier(0.32, 0.72, 0, 1), transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .bento-card:hover {
    border-color: rgba(77, 124, 255, 0.2);
    transform: translateY(-2px);
  }

  .bento-num {
    font-size: 0.6875rem;
    font-weight: 700;
    font-family: var(--font-mono);
    color: var(--accent-secondary);
    letter-spacing: 0.06em;
    display: block;
    margin-bottom: 1rem;
  }

  .bento-title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.3;
  }

  .bento-desc {
    font-size: 0.875rem;
    color: var(--text-muted);
    line-height: 1.65;
    margin: 0.75rem 0 0;
  }

  .bento-visual {
    display: flex;
    align-items: center;
    gap: 1.5rem;
    margin-bottom: 1.5rem;
    flex-wrap: wrap;
  }

  .bento-score-ring {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .bento-score-label {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .bento-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .bento-tag {
    font-size: 0.625rem;
    font-weight: 600;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    border: 1px solid;
  }
  .bento-tag--red { color: #FF6B6B; border-color: rgba(255,77,77,0.25); background: rgba(255,77,77,0.08); }
  .bento-tag--blue { color: #6B9AFF; border-color: rgba(77,124,255,0.25); background: rgba(77,124,255,0.08); }
  .bento-tag--gold { color: #FFC46B; border-color: rgba(255,184,77,0.25); background: rgba(255,184,77,0.08); }

  /* ═══ TESTIMONIALS ═══ */
  .testimonials {
    padding: 6rem 1.5rem;
    text-align: center;
    border-top: 1px solid var(--border-subtle);
  }

  .testimonial-grid {
    max-width: 64rem;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .testimonial-grid { grid-template-columns: repeat(3, 1fr); }
  }

  .testimonial-card {
    text-align: left;
    padding: 1.75rem;
    border-radius: 1.25rem;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.04);
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
    transition: border-color 0.4s cubic-bezier(0.32, 0.72, 0, 1), transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }
  .testimonial-card:hover {
    border-color: rgba(255, 184, 77, 0.2);
    transform: translateY(-2px);
  }

  .testimonial-text {
    font-size: 0.875rem;
    color: var(--text-secondary);
    line-height: 1.65;
    margin: 0;
    flex: 1;
  }

  .testimonial-author {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .testimonial-avatar {
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: var(--glass-medium);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.6875rem;
    font-weight: 700;
    color: var(--text-muted);
    flex-shrink: 0;
  }

  .testimonial-name {
    display: block;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .testimonial-role {
    display: block;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }

  /* ═══ FINAL CTA ═══ */
  .final-cta {
    position: relative;
    padding: 8rem 1.5rem;
    text-align: center;
    overflow: hidden;
  }

  .final-glow {
    position: absolute;
    width: 500px;
    height: 500px;
    bottom: -200px;
    left: 50%;
    transform: translateX(-50%);
    border-radius: 50%;
    background: radial-gradient(circle, rgba(255,77,77,0.06), transparent 70%);
    pointer-events: none;
  }

  .final-sub {
    position: relative;
    font-size: 1rem;
    color: var(--text-muted);
    margin: 1rem 0 2.5rem;
    line-height: 1.6;
  }

  .final-cta .btn-primary { position: relative; }
  .final-cta .h2 { position: relative; }
</style>
