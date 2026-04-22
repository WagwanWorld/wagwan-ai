<script lang="ts">
  import { onMount } from 'svelte';
  import InstagramLogo from 'phosphor-svelte/lib/InstagramLogo';

  let visible = false;

  // Live activity feed rotation
  const feedMessages = [
    { text: 'Arjun in Mumbai just got matched with', brand: 'Razorpay' },
    { text: 'Priya earned', brand: '₹8,200 this week' },
    { text: 'Sneha in Bangalore matched with', brand: 'CRED' },
    { text: 'Maya completed her', brand: '12th brand deal' },
    { text: 'Karthik just got paid', brand: '₹18,300' },
    { text: 'Rohan in Delhi matched with', brand: 'Zerodha' },
  ];
  let feedIndex = 0;
  let feedVisible = true;

  onMount(() => {
    setTimeout(() => { visible = true; }, 60);

    const interval = setInterval(() => {
      feedVisible = false;
      setTimeout(() => {
        feedIndex = (feedIndex + 1) % feedMessages.length;
        feedVisible = true;
      }, 400);
    }, 3500);

    return () => clearInterval(interval);
  });
</script>

<div class="preview-root" data-app-chrome="dark">
  <!-- Background — pulled way back, barely there -->
  <div class="bg-gradient" class:ready={visible}>
    <div class="bg-orb bg-orb--warm"></div>
    <div class="bg-orb bg-orb--cool"></div>
  </div>

  <div class="preview-content" class:ready={visible}>

    <!-- ═══════════════════════════════════════════
         DESKTOP
         ═══════════════════════════════════════════ -->
    <div class="preview-frame">
      <div class="frame-label">Desktop · 1440 × 900</div>
      <div class="frame-viewport frame-viewport--desktop">
        <nav class="hero-nav">
          <img src="/logo-white.svg" alt="WagwanAI" class="hero-logo" />
          <span class="nav-pill">For creators</span>
        </nav>

        <div class="hero-center">
          <h1 class="hero-h1">
            Get matched with brands.<br>
            <span class="gradient-phrase">Get paid weekly.</span><br>
            Skip the DMs.
          </h1>

          <p class="hero-sub">
            Wagwan finds brands whose audiences match yours, drafts the content,
            and handles payouts. You approve everything before it goes live.
          </p>

          <button class="ig-btn" on:click={() => {}}>
            <InstagramLogo size={20} weight="bold" />
            Continue with Instagram
          </button>

          <p class="trust-line">
            We see your public profile and insights. Never your DMs or password.
          </p>

          <!-- Live activity — single rotating line -->
          <div class="feed-ticker" class:feed-show={feedVisible}>
            <div class="feed-dot"></div>
            <span>{feedMessages[feedIndex].text} <strong>{feedMessages[feedIndex].brand}</strong></span>
          </div>
        </div>

        <!-- Bottom bar — stats + how it works, anchored to bottom of viewport -->
        <div class="hero-bottom">
          <div class="stats-row">
            <span class="stat"><strong>2,400+</strong> creators</span>
            <span class="stat-sep">/</span>
            <span class="stat"><strong>₹14L+</strong> paid out</span>
            <span class="stat-sep">/</span>
            <span class="stat"><strong>180+</strong> brands</span>
          </div>

          <div class="how-row">
            <div class="how-item">
              <span class="how-num">01</span>
              <div>
                <div class="how-title">Brands find you</div>
                <div class="how-desc">Based on your vibe, not your follower count.</div>
              </div>
            </div>
            <div class="how-sep"></div>
            <div class="how-item">
              <span class="how-num">02</span>
              <div>
                <div class="how-title">Content drafted for you</div>
                <div class="how-desc">You approve before posting. Always.</div>
              </div>
            </div>
            <div class="how-sep"></div>
            <div class="how-item">
              <span class="how-num">03</span>
              <div>
                <div class="how-title">We handle the receipts</div>
                <div class="how-desc">Analytics sent to brands. You don't touch a thing.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════
         MOBILE
         ═══════════════════════════════════════════ -->
    <div class="preview-frame">
      <div class="frame-label">iPhone 14 Pro · 390 × 844</div>
      <div class="frame-viewport frame-viewport--mobile">
        <nav class="hero-nav hero-nav--mobile">
          <img src="/logo-white.svg" alt="WagwanAI" class="hero-logo" />
          <span class="nav-pill nav-pill--mobile">For creators</span>
        </nav>

        <div class="hero-center hero-center--mobile">
          <h1 class="hero-h1 hero-h1--mobile">
            Get matched<br>with brands.<br>
            <span class="gradient-phrase">Get paid weekly.</span><br>
            Skip the DMs.
          </h1>

          <p class="hero-sub hero-sub--mobile">
            Wagwan finds brands whose audiences match yours, drafts the content,
            and handles payouts. You approve everything before it goes live.
          </p>

          <button class="ig-btn ig-btn--mobile" on:click={() => {}}>
            <InstagramLogo size={20} weight="bold" />
            Continue with Instagram
          </button>

          <p class="trust-line trust-line--mobile">
            We see your public profile and insights. Never your DMs or password.
          </p>

          <div class="feed-ticker feed-ticker--mobile" class:feed-show={feedVisible}>
            <div class="feed-dot"></div>
            <span>{feedMessages[feedIndex].text} <strong>{feedMessages[feedIndex].brand}</strong></span>
          </div>
        </div>

        <div class="hero-bottom hero-bottom--mobile">
          <div class="stats-row stats-row--mobile">
            <span class="stat"><strong>2,400+</strong> creators</span>
            <span class="stat-sep">/</span>
            <span class="stat"><strong>₹14L+</strong> paid</span>
            <span class="stat-sep">/</span>
            <span class="stat"><strong>180+</strong> brands</span>
          </div>

          <div class="how-col">
            <div class="how-item how-item--compact">
              <span class="how-num">01</span>
              <div>
                <div class="how-title">Brands find you</div>
                <div class="how-desc">Based on your vibe, not follower count.</div>
              </div>
            </div>
            <div class="how-item how-item--compact">
              <span class="how-num">02</span>
              <div>
                <div class="how-title">Content drafted for you</div>
                <div class="how-desc">You approve before posting. Always.</div>
              </div>
            </div>
            <div class="how-item how-item--compact">
              <span class="how-num">03</span>
              <div>
                <div class="how-title">We handle the receipts</div>
                <div class="how-desc">Analytics sent to brands automatically.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</div>

<style>
  /* ══════════════════════════════════════════════════════════
     PREVIEW SHELL
     ══════════════════════════════════════════════════════════ */
  .preview-root {
    position: fixed; inset: 0;
    background: #060608;
    overflow-y: auto;
    scrollbar-width: none;
    font-family: 'Geist Variable', 'Inter', -apple-system, sans-serif;
    color: #EDEDEF;
  }

  /* ── Background — very restrained, almost invisible ── */
  .bg-gradient {
    position: fixed; inset: 0;
    opacity: 0; transition: opacity 2s ease;
    pointer-events: none; z-index: 0;
  }
  .bg-gradient.ready { opacity: 1; }
  .bg-orb { position: absolute; border-radius: 50%; }
  .bg-orb--warm {
    width: 100vw; height: 100vw; left: -20%; top: -40%;
    background: radial-gradient(ellipse, oklch(50% 0.20 25 / 0.10) 0%, transparent 55%);
    filter: blur(120px);
  }
  .bg-orb--cool {
    width: 80vw; height: 80vw; right: -30%; bottom: -20%;
    background: radial-gradient(ellipse, oklch(45% 0.18 260 / 0.08) 0%, transparent 55%);
    filter: blur(120px);
  }

  /* ── Content wrapper ── */
  .preview-content {
    position: relative; z-index: 1;
    display: flex; flex-direction: column; align-items: center;
    padding: 48px 24px 96px; gap: 64px;
    opacity: 0; transform: translateY(8px);
    transition: opacity 0.8s ease 0.1s, transform 0.8s ease 0.1s;
  }
  .preview-content.ready { opacity: 1; transform: translateY(0); }

  /* ── Frame wrappers ── */
  .preview-frame { display: flex; flex-direction: column; gap: 16px; }
  .frame-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.12em; color: #3A3A40;
  }
  .frame-viewport {
    background: #0F0F11;
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 20px; overflow: hidden;
    display: flex; flex-direction: column;
  }
  .frame-viewport--desktop { width: 960px; height: 600px; padding: 0 80px; }
  .frame-viewport--mobile { width: 390px; height: 844px; padding: 0 24px; }


  /* ══════════════════════════════════════════════════════════
     HERO LAYOUT — vertical center with bottom-anchored info
     ══════════════════════════════════════════════════════════ */

  /* ── Nav ── */
  .hero-nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 28px 0 0; flex-shrink: 0;
  }
  .hero-nav--mobile { padding: 20px 0 0; }
  .hero-logo { height: 16px; opacity: 0.5; }
  .nav-pill {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px; font-weight: 500; text-transform: uppercase;
    letter-spacing: 0.1em; color: #3A3A40;
    padding: 5px 12px;
    border: 1px solid rgba(255,255,255,0.04);
    border-radius: 100px;
  }
  .nav-pill--mobile { font-size: 9px; padding: 4px 10px; }

  /* ── Center block ── */
  .hero-center {
    flex: 1;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    text-align: center;
    padding: 0 0 20px;
  }
  .hero-center--mobile { padding: 0 0 12px; }

  /* ── Headline ── */
  .hero-h1 {
    font-family: 'Geist Variable', 'Inter', sans-serif;
    font-size: 48px; font-weight: 750;
    line-height: 1.1; letter-spacing: -0.04em;
    color: #EDEDEF; margin: 0 0 24px;
  }
  .hero-h1--mobile { font-size: 32px; margin: 0 0 18px; }

  .gradient-phrase {
    background: linear-gradient(135deg, #E87FA8 0%, #E8833A 55%, #D9C26E 100%);
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  /* ── Subhead ── */
  .hero-sub {
    font-size: 16px; line-height: 1.65;
    color: #6A6A72; max-width: 420px;
    margin: 0 0 36px; font-weight: 400;
  }
  .hero-sub--mobile { font-size: 14px; margin: 0 0 28px; max-width: 320px; }


  /* ══════════════════════════════════════════════════════════
     INSTAGRAM BUTTON — Variant A, refined
     ══════════════════════════════════════════════════════════ */
  .ig-btn {
    display: flex; align-items: center; justify-content: center; gap: 10px;
    width: 100%; max-width: 340px;
    height: 52px; padding: 0 32px;
    border: none; border-radius: 13px;
    background: linear-gradient(135deg, #F58529 0%, #DD2A7B 50%, #8134AF 80%, #515BD4 100%);
    color: #fff; font-size: 15px; font-weight: 600;
    font-family: inherit; cursor: pointer;
    box-shadow: 0 4px 32px rgba(221, 42, 123, 0.20);
    transition: transform 0.25s ease, box-shadow 0.4s ease;
    position: relative; overflow: hidden;
  }
  .ig-btn::before {
    content: '';
    position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 50%);
    opacity: 0; transition: opacity 0.3s ease;
  }
  .ig-btn:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 40px rgba(221, 42, 123, 0.28), 0 0 60px rgba(221, 42, 123, 0.08);
  }
  .ig-btn:hover::before { opacity: 1; }
  .ig-btn:active { transform: scale(0.985); }
  .ig-btn--mobile { max-width: 100%; height: 56px; border-radius: 14px; }


  /* ── Trust line ── */
  .trust-line {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 11px; color: #3A3A40;
    margin: 16px 0 0; letter-spacing: 0.01em;
    font-weight: 400;
  }
  .trust-line--mobile { font-size: 10px; margin: 14px 0 0; }

  /* ── Live activity ticker ── */
  .feed-ticker {
    display: flex; align-items: center; gap: 8px;
    margin: 24px 0 0;
    font-size: 12px; color: #4A4A50;
    opacity: 0; transform: translateY(4px);
    transition: opacity 0.35s ease, transform 0.35s ease;
  }
  .feed-ticker.feed-show { opacity: 1; transform: translateY(0); }
  .feed-ticker--mobile { font-size: 11px; margin: 20px 0 0; }
  .feed-ticker strong { color: #8A8A90; font-weight: 600; }
  .feed-dot {
    width: 5px; height: 5px; border-radius: 50%;
    background: #4ade80; flex-shrink: 0;
    box-shadow: 0 0 6px rgba(74, 222, 128, 0.35);
    animation: pulse-dot 2.5s ease-in-out infinite;
  }
  @keyframes pulse-dot {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.3; }
  }


  /* ══════════════════════════════════════════════════════════
     BOTTOM BAR — anchored, quiet, editorial
     ══════════════════════════════════════════════════════════ */
  .hero-bottom {
    flex-shrink: 0;
    padding: 0 0 28px;
    display: flex; flex-direction: column; gap: 20px;
    border-top: 1px solid rgba(255,255,255,0.03);
    padding-top: 20px;
  }
  .hero-bottom--mobile { padding: 0 0 20px; gap: 16px; padding-top: 16px; }

  /* Stats */
  .stats-row {
    display: flex; align-items: center; gap: 10px;
    font-size: 11px; color: #3A3A40;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
  }
  .stats-row--mobile { font-size: 10px; gap: 8px; }
  .stat strong { color: #5A5A62; font-weight: 600; }
  .stat-sep { color: #2A2A30; font-weight: 300; }

  /* How it works — desktop */
  .how-row {
    display: flex; align-items: flex-start; gap: 0;
  }
  .how-item {
    display: flex; align-items: flex-start; gap: 12px;
    flex: 1;
    padding: 0 20px;
  }
  .how-item:first-child { padding-left: 0; }
  .how-item:last-child { padding-right: 0; }
  .how-sep {
    width: 1px; height: 36px;
    background: rgba(255,255,255,0.04);
    flex-shrink: 0; margin-top: 2px;
  }
  .how-num {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 10px; font-weight: 500;
    color: #2A2A30; flex-shrink: 0;
    margin-top: 2px;
  }
  .how-title {
    font-size: 13px; font-weight: 600; color: #8A8A90;
    margin-bottom: 3px;
  }
  .how-desc {
    font-size: 11px; color: #4A4A50; line-height: 1.5;
    font-weight: 400;
  }

  /* How it works — mobile */
  .how-col {
    display: flex; flex-direction: column; gap: 12px;
  }
  .how-item--compact {
    padding: 0;
  }
  .how-item--compact .how-title { font-size: 12px; }
  .how-item--compact .how-desc { font-size: 10px; }

  /* ── Responsive ── */
  @media (max-width: 1020px) {
    .frame-viewport--desktop { width: 100%; min-width: 0; }
  }
  @media (max-width: 440px) {
    .frame-viewport--mobile { width: 100%; min-width: 0; }
  }
</style>
