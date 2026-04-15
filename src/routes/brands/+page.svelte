<script lang="ts">
  import { onMount } from 'svelte';

  let visible = false;
  let statsVisible = false;
  let statsEl: HTMLElement;
  let countedValues = { conversion: 0, creators: 0, acceptance: 0 };

  const TARGETS = { conversion: 3.2, creators: 847, acceptance: 92 };

  const creators = [
    { emoji: '🎨', name: 'Arjun Mehta', type: 'Design-led builder', followers: '8.2k', tags: ['SaaS', 'Product'], gradient: '#FF4D4D, #FFB84D', vibe: 'Ships pixel-perfect products weekly' },
    { emoji: '✨', name: 'Priya Nair', type: 'Cultural storyteller', followers: '12.4k', tags: ['Fashion', 'Culture'], gradient: '#4D7CFF, #FF4D4D', vibe: 'Makes brands feel like movements' },
    { emoji: '📈', name: 'Rohan Desai', type: 'Fintech evangelist', followers: '6.1k', tags: ['Fintech', 'Startups'], gradient: '#FFB84D, #4D7CFF', vibe: 'Turns complex finance into stories' },
    { emoji: '🧘', name: 'Shreya Kapoor', type: 'Wellness advocate', followers: '15.7k', tags: ['Wellness', 'Lifestyle'], gradient: '#FF4D4D, #4D7CFF', vibe: 'Her audience actually buys what she loves' },
    { emoji: '⚡', name: 'Vikram Singh', type: 'Tech reviewer', followers: '9.8k', tags: ['Tech', 'Reviews'], gradient: '#4D7CFF, #FFB84D', vibe: 'Founders trust his take on tools' },
    { emoji: '🍜', name: 'Maya Iyer', type: 'Food & travel creator', followers: '22.1k', tags: ['Food', 'Travel'], gradient: '#FFB84D, #FF4D4D', vibe: 'Every post drives restaurant traffic' },
  ];

  // Floating faces for hero background
  const floatingFaces = ['👩🏽‍💻', '🧑🏻‍🎨', '👨🏾‍🍳', '👩🏼‍🔬', '🧑🏽‍💼', '👨🏻‍🎤', '👩🏾‍🏫', '🧑🏼‍🚀'];
  const floatingPositions = [
    { top: '8%', left: '5%', delay: '0s', size: '2.5rem' },
    { top: '15%', right: '8%', delay: '0.5s', size: '2rem' },
    { top: '45%', left: '2%', delay: '1s', size: '1.75rem' },
    { top: '70%', right: '5%', delay: '1.5s', size: '2.25rem' },
    { top: '80%', left: '8%', delay: '2s', size: '1.5rem' },
    { top: '30%', right: '3%', delay: '0.3s', size: '1.75rem' },
    { top: '55%', right: '12%', delay: '1.2s', size: '2rem' },
    { top: '25%', left: '12%', delay: '0.8s', size: '1.5rem' },
  ];

  function animateCounters() {
    const duration = 1500;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - t, 3);
      countedValues = {
        conversion: +(TARGETS.conversion * ease).toFixed(1),
        creators: Math.round(TARGETS.creators * ease),
        acceptance: Math.round(TARGETS.acceptance * ease),
      };
      if (t < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  onMount(() => {
    setTimeout(() => { visible = true; }, 60);

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !statsVisible) {
        statsVisible = true;
        animateCounters();
        observer.disconnect();
      }
    }, { threshold: 0.3 });
    if (statsEl) observer.observe(statsEl);
  });
</script>

<div class="landing" class:visible>

  <!-- ═══ HERO ═══ -->
  <section class="hero">
    <div class="hero-glow" aria-hidden="true"></div>
    <div class="hero-glow hero-glow--warm" aria-hidden="true"></div>

    <!-- Floating emoji faces -->
    {#each floatingFaces as face, i}
      <span
        class="floating-face"
        style="top: {floatingPositions[i].top}; {floatingPositions[i].left ? `left: ${floatingPositions[i].left}` : `right: ${floatingPositions[i].right}`}; animation-delay: {floatingPositions[i].delay}; font-size: {floatingPositions[i].size};"
        aria-hidden="true"
      >{face}</span>
    {/each}

    <div class="hero-split">
      <div class="hero-left">
        <div class="eyebrow-pill eyebrow-pill--glow">Your people are out there</div>
        <h1 class="h1">
          Find creators whose<br/>
          audiences <span class="h1-accent-gradient">actually look</span><br/>
          <span class="h1-accent-gradient">like your buyers.</span>
        </h1>
        <p class="hero-sub">
          Tell us who you're trying to reach. We'll match you to micro-creators
          whose followers are genuinely your people — not just big numbers.
        </p>
        <div class="hero-ctas">
          <a href="/brands/portal" class="btn-primary btn-primary--glow">
            <span>Let's find them</span>
            <span class="btn-icon">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2 7h10M8 3l4 4-4 4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </span>
          </a>
          <a href="#how" class="btn-ghost">See how it works</a>
        </div>
        <div class="hero-social-proof">
          <div class="avatar-stack">
            {#each ['🧑🏽‍💼', '👩🏻‍💻', '👨🏾‍🎨'] as emoji}
              <span class="avatar-stack-item">{emoji}</span>
            {/each}
          </div>
          <span class="hero-proof-text">47 brands matched this week</span>
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
              <p class="preview-msg preview-msg--agent preview-msg--animated" style="animation-delay: 600ms;">What's your main campaign goal?</p>
              <div class="preview-chips preview-chips--animated" style="animation-delay: 1000ms;">
                <span class="preview-chip">Get seen by the right people</span>
                <span class="preview-chip preview-chip--selected">Build trust</span>
                <span class="preview-chip">Drive purchases</span>
              </div>
              <p class="preview-msg preview-msg--agent preview-msg--animated" style="animation-delay: 1600ms;">Great taste. Who specifically should see this?</p>
            </div>
            <div class="preview-result preview-result--animated" style="animation-delay: 2200ms;">
              <div class="preview-result-header">
                <span class="preview-result-emoji">🎨</span>
                <div>
                  <span class="preview-result-name">Arjun Mehta</span>
                  <span class="preview-result-meta">Builder archetype · 8.2k · Mumbai</span>
                </div>
                <span class="preview-result-badge">92%</span>
              </div>
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
  <section class="stats" bind:this={statsEl}>
    <div class="stats-inner">
      <div class="stat">
        <span class="stat-num">{countedValues.conversion}x</span>
        <span class="stat-label">Higher conversion vs. traditional influencer outreach</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-num">{countedValues.creators}</span>
        <span class="stat-label">Portrait-verified creators in the network</span>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <span class="stat-num">{countedValues.acceptance}%</span>
        <span class="stat-label">Brand brief acceptance rate from matched creators</span>
      </div>
    </div>
  </section>

  <!-- ═══ CREATOR SHOWCASE ═══ -->
  <section class="creator-showcase">
    <div class="creator-showcase-header">
      <div class="eyebrow-pill">Real people, real audiences</div>
      <h2 class="h2">Creators who actually move the needle.</h2>
    </div>
    <div class="creator-strip">
      {#each creators as c, i}
        <div class="creator-card" style="animation-delay: {i * 0.1}s">
          <div class="creator-avatar" style="background: linear-gradient(135deg, {c.gradient});">
            <span class="creator-emoji">{c.emoji}</span>
          </div>
          <span class="creator-name">{c.name}</span>
          <span class="creator-type">{c.type}</span>
          <span class="creator-vibe">{c.vibe}</span>
          <span class="creator-followers">{c.followers} followers</span>
          <div class="creator-tags">
            {#each c.tags as tag}
              <span class="creator-tag">{tag}</span>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  </section>

  <!-- ═══ BENTO SHOWCASE ═══ -->
  <section class="bento" id="how">
    <div class="bento-header">
      <div class="eyebrow-pill">Dead simple</div>
      <h2 class="h2">Three steps.<br/>Real results.</h2>
    </div>

    <div class="bento-grid">
      <div class="bento-card bento-card--wide">
        <span class="bento-num">01</span>
        <h3 class="bento-title">Just tell us who you're looking for</h3>
        <p class="bento-desc">
          "People who care about sustainable fashion and actually buy." That's all we need.
          Our AI figures out the rest — no spreadsheets, no filters, no 47-field forms.
        </p>
      </div>

      <div class="bento-card">
        <span class="bento-num">02</span>
        <h3 class="bento-title">We know who actually follows them</h3>
        <p class="bento-desc">
          Not vanity metrics. We look at what creators' audiences care about, buy, and do —
          built from real data across Instagram, Spotify, Google, and LinkedIn.
        </p>
      </div>

      <div class="bento-card">
        <span class="bento-num">03</span>
        <h3 class="bento-title">Pick creators, hit go</h3>
        <p class="bento-desc">
          Select the ones you like, launch the campaign. They get your brief, set their rates,
          and say yes. That's it. No back-and-forth DMs.
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
          <div class="campaign-brief">
            <span class="campaign-brief-title">Campaign Brief</span>
            <div class="campaign-brief-divider"></div>
            <div class="campaign-brief-row">
              <span class="campaign-brief-label">Brand</span>
              <span class="campaign-brief-value">Tooljet</span>
            </div>
            <div class="campaign-brief-row">
              <span class="campaign-brief-label">Goal</span>
              <span class="campaign-brief-value">Awareness</span>
            </div>
            <div class="campaign-brief-row">
              <span class="campaign-brief-label">Budget</span>
              <span class="campaign-brief-value">&#8377;15k</span>
            </div>
            <p class="campaign-brief-prompt">"Share how you build..."</p>
            <span class="campaign-brief-badge">Accepted</span>
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
    <h2 class="h2">Your people are one<br/>conversation away.</h2>
    <p class="final-sub">Takes 2 minutes. No signup needed to try.</p>
    <a href="/brands/portal" class="btn-primary btn-primary--lg btn-primary--glow">
      <span>Let's go</span>
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

  .h1-accent-gradient {
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary), var(--accent-tertiary));
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
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

  .btn-primary--glow {
    box-shadow: 0 0 24px rgba(255, 77, 77, 0.3), 0 0 60px rgba(255, 77, 77, 0.1);
  }
  .btn-primary--glow:hover {
    box-shadow: 0 0 32px rgba(255, 77, 77, 0.4), 0 0 80px rgba(255, 77, 77, 0.15);
  }

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

  /* ── Eyebrow glow ── */
  .eyebrow-pill--glow {
    border-color: rgba(255, 77, 77, 0.25);
    color: var(--accent-primary);
    background: rgba(255, 77, 77, 0.06);
  }

  /* ── Floating faces ── */
  .floating-face {
    position: absolute;
    opacity: 0;
    animation: float-bob 6s ease-in-out infinite, float-in 1s ease-out forwards;
    pointer-events: none;
    z-index: 0;
    filter: grayscale(0.2);
  }

  @keyframes float-bob {
    0%, 100% { transform: translateY(0) rotate(0deg); }
    33% { transform: translateY(-12px) rotate(3deg); }
    66% { transform: translateY(6px) rotate(-2deg); }
  }

  @keyframes float-in {
    from { opacity: 0; transform: scale(0.5); }
    to { opacity: 0.35; transform: scale(1); }
  }

  @media (max-width: 767px) {
    .floating-face { display: none; }
  }

  /* ── Social proof ── */
  .hero-social-proof {
    margin-top: 2rem;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .avatar-stack {
    display: flex;
  }

  .avatar-stack-item {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background: var(--glass-medium);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    margin-left: -6px;
    border: 2px solid var(--bg-primary);
  }

  .avatar-stack-item:first-child {
    margin-left: 0;
  }

  .hero-proof-text {
    font-size: 0.8125rem;
    color: var(--text-muted);
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

  .hero-glow--warm {
    top: auto;
    bottom: -300px;
    left: -100px;
    right: auto;
    width: 700px;
    height: 700px;
    background: radial-gradient(circle, rgba(255, 77, 77, 0.06), rgba(255, 184, 77, 0.03), transparent 70%);
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

  /* ── Animated hero messages ── */
  .preview-msg--animated {
    opacity: 0;
    animation: msgFadeUp 0.5s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    animation-fill-mode: both;
  }

  .preview-result--animated {
    opacity: 0;
    animation: resultSlideIn 0.5s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    animation-fill-mode: both;
  }

  @keyframes msgFadeUp {
    from {
      opacity: 0;
      transform: translateY(12px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes resultSlideIn {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Preview chips */
  .preview-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    padding: 0 16px;
  }

  .preview-chips--animated {
    opacity: 0;
    animation: msgFadeUp 0.5s cubic-bezier(0.32, 0.72, 0, 1) forwards;
    animation-fill-mode: both;
  }

  .preview-chip {
    font-size: 0.6875rem;
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    color: var(--text-secondary);
    transition: all 0.2s;
  }

  .preview-chip--selected {
    border-color: var(--accent-primary);
    background: rgba(255, 77, 77, 0.08);
    color: var(--accent-primary);
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

  .preview-result-emoji {
    font-size: 1.25rem;
    flex-shrink: 0;
  }

  .preview-result-badge {
    font-size: 0.6875rem;
    font-weight: 800;
    font-family: var(--font-mono);
    color: var(--accent-primary);
    background: rgba(255,77,77,0.12);
    padding: 2px 8px;
    border-radius: 9999px;
    margin-left: auto;
  }

  .preview-result-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
    display: block;
  }

  .preview-result-meta {
    font-size: 0.625rem;
    color: var(--text-muted);
    display: block;
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

  /* ═══ CREATOR SHOWCASE ═══ */
  .creator-showcase {
    padding: 5rem 1.5rem;
    border-top: 1px solid var(--border-subtle);
  }

  .creator-showcase-header {
    text-align: center;
    margin-bottom: 2.5rem;
  }

  .creator-strip {
    display: flex;
    gap: 1rem;
    overflow-x: auto;
    scroll-snap-type: x mandatory;
    padding: 0.5rem 0 1.5rem;
    mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
    -webkit-mask-image: linear-gradient(to right, transparent, black 5%, black 95%, transparent);
    max-width: 72rem;
    margin: 0 auto;
  }

  .creator-strip::-webkit-scrollbar {
    display: none;
  }

  .creator-card {
    flex: 0 0 200px;
    scroll-snap-align: start;
    padding: 1.25rem;
    border-radius: 1rem;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.04);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
    text-align: center;
    transition: border-color 0.4s cubic-bezier(0.32, 0.72, 0, 1), transform 0.4s cubic-bezier(0.32, 0.72, 0, 1);
  }

  .creator-card:hover {
    border-color: rgba(77, 124, 255, 0.2);
    transform: translateY(-2px);
  }

  .creator-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .creator-initial {
    font-size: 1.125rem;
    font-weight: 700;
    color: #fff;
  }

  .creator-emoji {
    font-size: 1.5rem;
  }

  .creator-vibe {
    font-size: 0.6875rem;
    color: var(--text-secondary);
    line-height: 1.4;
    font-style: italic;
  }

  .creator-name {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .creator-type {
    font-size: 0.6875rem;
    color: var(--text-muted);
    line-height: 1.3;
  }

  .creator-followers {
    font-size: 0.75rem;
    font-weight: 600;
    font-family: var(--font-mono);
    color: var(--text-secondary);
  }

  .creator-tags {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
    justify-content: center;
  }

  .creator-tag {
    font-size: 0.5625rem;
    font-weight: 600;
    padding: 0.2rem 0.5rem;
    border-radius: 9999px;
    border: 1px solid var(--border-subtle);
    color: var(--text-muted);
    background: var(--glass-light);
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

  /* ── Campaign brief mock ── */
  .campaign-brief {
    padding: 1rem;
    border-radius: 0.75rem;
    border: 1px solid var(--border-subtle);
    background: var(--glass-light);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    box-shadow: inset 0 1px 1px rgba(255,255,255,0.04);
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    min-width: 180px;
  }

  .campaign-brief-title {
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.01em;
  }

  .campaign-brief-divider {
    height: 1px;
    background: var(--border-subtle);
    margin: 0.125rem 0;
  }

  .campaign-brief-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
  }

  .campaign-brief-label {
    font-size: 0.625rem;
    color: var(--text-muted);
    font-weight: 500;
  }

  .campaign-brief-value {
    font-size: 0.6875rem;
    color: var(--text-secondary);
    font-weight: 600;
    font-family: var(--font-mono);
  }

  .campaign-brief-prompt {
    font-size: 0.625rem;
    color: var(--text-muted);
    font-style: italic;
    margin: 0.25rem 0 0;
    line-height: 1.4;
  }

  .campaign-brief-badge {
    display: inline-flex;
    align-self: flex-start;
    font-size: 0.5625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0.25rem 0.625rem;
    border-radius: 9999px;
    color: #34D399;
    border: 1px solid rgba(52, 211, 153, 0.25);
    background: rgba(52, 211, 153, 0.08);
    margin-top: 0.25rem;
  }

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
