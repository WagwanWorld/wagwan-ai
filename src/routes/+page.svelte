<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { profile, type UserProfile } from '$lib/stores/profile';
  import { get } from 'svelte/store';
  import {
    isAppSessionValid,
    maybeRepairIgOnlyAccountKey,
  } from '$lib/auth/sessionGate';

  let visible = false;
  let g1: HTMLDivElement, g2: HTMLDivElement, g3: HTMLDivElement;
  let raf: number;
  let shouldShowLanding = false;

  function startGradient() {
    let prev = 0;
    function tick(ts: number) {
      prev = ts;
      const t = ts * 0.001;
      if (g1) {
        const x = Math.sin(t * 0.107) * 22 + Math.sin(t * 0.229) * 10;
        const y = Math.cos(t * 0.091) * 18 + Math.cos(t * 0.173) * 8;
        g1.style.transform = `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh))`;
      }
      if (g2) {
        const x = Math.sin(t * 0.173 + 1.3) * 28 + Math.cos(t * 0.293) * 12;
        const y = Math.cos(t * 0.131 + 0.8) * 22 + Math.sin(t * 0.211) * 9;
        g2.style.transform = `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh))`;
      }
      if (g3) {
        const x = Math.sin(t * 0.059 + 0.5) * 14 + Math.cos(t * 0.089) * 7;
        const y = Math.cos(t * 0.047 + 1.2) * 16 + Math.sin(t * 0.079) * 6;
        g3.style.transform = `translate(calc(-50% + ${x}vw), calc(-50% + ${y}vh))`;
      }
      raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
  }

  onMount(() => {
    try {
      const raw = localStorage.getItem('wagwan_profile_v2');
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.setupComplete) {
        const repaired = maybeRepairIgOnlyAccountKey(parsed as UserProfile);
        if (repaired) {
          profile.set(repaired);
          void fetch('/api/profile/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              googleSub: repaired.googleSub,
              profile: repaired,
              tokens: {},
            }),
          }).catch(() => {});
        }
        if (isAppSessionValid(get(profile))) {
          goto('/home', { replaceState: true });
          return;
        }
      }
    } catch {}
    shouldShowLanding = true;
    setTimeout(() => { visible = true; startGradient(); }, 60);
  });

  onDestroy(() => { if (raf) cancelAnimationFrame(raf); });
</script>

{#if shouldShowLanding}
<div class="landing-root">
  <div class="landing-grad" class:ready={visible}>
    <div class="landing-g landing-g--a" bind:this={g1}></div>
    <div class="landing-g landing-g--b" bind:this={g2}></div>
    <div class="landing-g landing-g--c" bind:this={g3}></div>
    <div class="landing-vignette" aria-hidden="true"></div>
  </div>

  <div class="landing-content" class:ready={visible}>
    <nav class="landing-nav">
      <span class="landing-logo">wagwan</span>
    </nav>

    <div class="landing-hero">
      <h1 class="landing-h1">Your identity,<br>understood.</h1>
      <p class="landing-sub">
        Wagwan AI learns who you are from the platforms you use —
        your music, your posts, your calendar — and gives you
        personalized recommendations, insights, and a living digital identity.
      </p>
      <button class="landing-cta" on:click={() => goto('/onboarding')}>
        Get Started
      </button>
    </div>

    <div class="landing-features">
      <div class="landing-feature">
        <div class="landing-feature-icon">&#10024;</div>
        <h3 class="landing-feature-title">Know yourself better</h3>
        <p class="landing-feature-desc">AI-powered identity graph built from your real digital footprint.</p>
      </div>
      <div class="landing-feature">
        <div class="landing-feature-icon">&#9881;</div>
        <h3 class="landing-feature-title">Personalized everything</h3>
        <p class="landing-feature-desc">Recommendations for food, music, events, and more — tuned to you.</p>
      </div>
      <div class="landing-feature">
        <div class="landing-feature-icon">&#128274;</div>
        <h3 class="landing-feature-title">Your data, your control</h3>
        <p class="landing-feature-desc">You decide what to connect and what stays private. Always.</p>
      </div>
    </div>
  </div>
</div>
{:else}
<div style="flex:1; display:flex; align-items:center; justify-content:center;">
  <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#7C3AED,#4F46E5);display:flex;align-items:center;justify-content:center;font-size:22px;" class="pulse-glow">
    ✦
  </div>
</div>
{/if}

<style>
  .landing-root {
    position: fixed; inset: 0;
    background: var(--bg-primary);
    overflow-y: auto;
    scrollbar-width: none;
    font-family: var(--font-sans);
  }

  .landing-grad {
    position: fixed; inset: 0;
    opacity: 0;
    transition: opacity 2s ease;
    pointer-events: none;
    z-index: 0;
  }
  .landing-grad.ready { opacity: 1; }

  .landing-g {
    position: absolute;
    border-radius: 50%;
    will-change: transform;
    transform: translate(-50%, -50%);
  }
  .landing-g--a {
    width: 110vw; height: 110vw;
    left: 30%; top: 20%;
    background: radial-gradient(ellipse at center, var(--ambient-blue) 0%, transparent 70%);
    filter: blur(calc(72px * var(--mesh-blur-scale, 1)));
    opacity: calc(0.52 * var(--mesh-orb-opacity-scale, 1));
  }
  .landing-g--b {
    width: 85vw; height: 85vw;
    left: 60%; top: 55%;
    background: radial-gradient(ellipse at center, var(--ambient-red) 0%, transparent 70%);
    filter: blur(calc(64px * var(--mesh-blur-scale, 1)));
    opacity: calc(0.32 * var(--mesh-orb-opacity-scale, 1));
  }
  .landing-g--c {
    width: 130vw; height: 130vw;
    left: 40%; top: 35%;
    background: radial-gradient(ellipse at center, var(--ambient-gold) 0%, transparent 72%);
    filter: blur(calc(90px * var(--mesh-blur-scale, 1)));
    opacity: calc(0.38 * var(--mesh-orb-opacity-scale, 1));
  }
  .landing-vignette {
    position: absolute; inset: 0;
    background: radial-gradient(ellipse at 50% 50%, transparent 40%, color-mix(in srgb, var(--bg-primary) 82%, #000) 100%);
    pointer-events: none;
  }

  .landing-content {
    position: relative;
    z-index: 1;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: env(safe-area-inset-top, 0px) 28px env(safe-area-inset-bottom, 28px);
    opacity: 0;
    transform: translateY(12px);
    transition: opacity 0.6s ease 0.3s, transform 0.6s ease 0.3s;
  }
  .landing-content.ready {
    opacity: 1;
    transform: translateY(0);
  }

  .landing-nav {
    padding: max(20px, env(safe-area-inset-top, 20px)) 0 0;
    flex-shrink: 0;
  }
  .landing-logo {
    font-size: 15px;
    font-weight: 700;
    letter-spacing: 0.04em;
    color: var(--text-muted);
  }

  .landing-hero {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 48px 0 32px;
  }

  .landing-h1 {
    font-family: var(--font-display);
    font-size: clamp(44px, 12vw, 64px);
    font-weight: 800;
    font-style: italic;
    line-height: 1.05;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin: 0 0 20px;
  }

  .landing-sub {
    font-size: 16px;
    color: var(--text-secondary);
    line-height: 1.65;
    max-width: min(26rem, 100%);
    margin: 0 0 36px;
  }

  .landing-cta {
    width: fit-content;
    padding: 16px 40px;
    border-radius: 100px;
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
    border: none;
    color: white;
    font-size: 16px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    box-shadow: 0 4px 24px var(--accent-glow);
    transition: transform 0.15s, opacity 0.15s;
  }
  .landing-cta:active { transform: scale(0.97); }

  .landing-features {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    padding-bottom: max(32px, env(safe-area-inset-bottom, 32px));
  }

  .landing-feature {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 20px;
    backdrop-filter: blur(var(--blur-light));
  }

  .landing-feature-icon {
    font-size: 24px;
    margin-bottom: 8px;
  }

  .landing-feature-title {
    font-size: 15px;
    font-weight: 700;
    color: var(--text-primary);
    margin: 0 0 6px;
  }

  .landing-feature-desc {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  @media (min-width: 768px) {
    .landing-content {
      max-width: 48rem;
      margin: 0 auto;
      width: 100%;
    }
    .landing-features {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
