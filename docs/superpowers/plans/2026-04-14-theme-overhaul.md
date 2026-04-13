# Theme Overhaul + Onboarding Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the acid-lime accent with a vibrant red/blue/yellow gradient system, add an animated moving gradient, redesign the landing page with product visual cards, and enhance onboarding with explanatory content.

**Architecture:** The color system is token-based (CSS custom properties), so changing the two token files propagates across the entire app. A few components hardcode lime fallbacks that need updating. The landing page gets product mock cards. The onboarding gets explanatory glass cards between steps. An animated gradient keyframe cycles the mesh orbs through the new color palette.

**Tech Stack:** SvelteKit, Svelte 5, CSS custom properties, Tailwind

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `src/styles/tokens-home-dark.css` | Replace lime accents with red/blue/yellow + animated gradient |
| Modify | `src/styles/tokens-light.css` | Same accent overhaul for light mode |
| Modify | `src/styles/utilities-extra.css` | Add mesh color-shift keyframes |
| Modify | `src/lib/components/DesktopSidebar.svelte` | Update hardcoded lime fallbacks |
| Modify | `src/lib/components/HomeContextRail.svelte` | Update hardcoded lime fallbacks |
| Modify | `src/lib/components/home/HeroIdentity.svelte` | Update hardcoded lime fallbacks |
| Modify | `src/lib/components/InferenceIdentityPanel.svelte` | Update hardcoded lime fallbacks |
| Modify | `src/lib/components/IdentityIntelligencePanel.svelte` | Update hardcoded lime fallback |
| Modify | `src/lib/components/HomeCurrentReadCard.svelte` | Update hardcoded lime fallback |
| Create | `src/lib/components/onboarding/ProductPreviewCard.svelte` | Mock product visual cards |
| Modify | `src/routes/+page.svelte` | Landing page with product visual cards + animated mesh |
| Modify | `src/routes/onboarding/+page.svelte` | Add explanatory content + preview cards |

---

### Task 1: Update Dark Theme Tokens

**Files:**
- Modify: `src/styles/tokens-home-dark.css`

- [ ] **Step 1: Replace accent colors**

In `src/styles/tokens-home-dark.css`, replace the lime accent block. Find and replace:

```css
    --home-lime: #c4f24a;
    --home-lime-soft: rgba(196, 242, 74, 0.14);
    --home-lime-glow: rgba(196, 242, 74, 0.32);
```

With:

```css
    --home-accent: #FF4D4D;
    --home-accent-soft: rgba(255, 77, 77, 0.14);
    --home-accent-glow: rgba(255, 77, 77, 0.32);
    --home-blue: #4D7CFF;
    --home-gold: #FFB84D;
```

- [ ] **Step 2: Replace home-accent-gradient**

Replace:

```css
    --home-accent-gradient: linear-gradient(90deg, #c4f24a 0%, oklch(55% 0.14 200) 100%);
```

With:

```css
    --home-accent-gradient: linear-gradient(90deg, #FF4D4D 0%, #4D7CFF 50%, #FFB84D 100%);
```

- [ ] **Step 3: Replace accent-primary/secondary/tertiary**

Replace:

```css
    --accent-primary: #c4f24a;
    --accent-secondary: #9edb2f;
    --accent-tertiary: #7cb518;
    --accent-glow: oklch(75% 0.22 130 / 0.32);
    --accent-soft: oklch(75% 0.22 130 / 0.12);
```

With:

```css
    --accent-primary: #FF4D4D;
    --accent-secondary: #4D7CFF;
    --accent-tertiary: #FFB84D;
    --accent-glow: rgba(255, 77, 77, 0.32);
    --accent-soft: rgba(255, 77, 77, 0.12);
```

- [ ] **Step 4: Replace ambient blob tints**

Replace:

```css
    /* Ambient blobs — lime + teal only (purple/indigo removed) */
    --blob-tint-a: oklch(75% 0.22 130 / 0.18);    /* lime */
    --blob-tint-b: oklch(55% 0.14 200 / 0.15);    /* deep teal */
    --blob-tint-c: oklch(65% 0.10 210 / 0.12);    /* teal-blue */
    --blob-glow: oklch(75% 0.22 130 / 0.20);
    --ambient-lime: oklch(75% 0.22 130 / 0.10);
    --ambient-teal: oklch(55% 0.14 200 / 0.10);
    --ambient-amber: oklch(72% 0.16 80 / 0.08);
    /* Legacy aliases used by AmbientGradients (updated in Task 6) */
    --ambient-blue: var(--ambient-teal);
    --ambient-red: oklch(58% 0.18 25 / 0.06);
    --ambient-gold: var(--ambient-lime);
```

With:

```css
    /* Ambient blobs — red / blue / gold */
    --blob-tint-a: oklch(60% 0.22 25 / 0.18);     /* warm red */
    --blob-tint-b: oklch(55% 0.20 260 / 0.16);    /* blue */
    --blob-tint-c: oklch(72% 0.16 80 / 0.14);     /* amber gold */
    --blob-glow: oklch(60% 0.22 25 / 0.20);
    --ambient-red: oklch(60% 0.22 25 / 0.15);
    --ambient-blue: oklch(55% 0.20 260 / 0.15);
    --ambient-gold: oklch(72% 0.16 80 / 0.12);
```

- [ ] **Step 5: Replace accent-gradient-wash and accent-border-mesh**

Replace:

```css
    --accent-gradient-wash: linear-gradient(
      120deg,
      oklch(75% 0.22 130 / 0.12) 0%,
      oklch(55% 0.14 200 / 0.10) 45%,
      oklch(65% 0.10 210 / 0.08) 100%
    );
    --accent-border-mesh: linear-gradient(
      135deg,
      oklch(75% 0.22 130 / 0.42),
      oklch(55% 0.14 200 / 0.35),
      oklch(65% 0.10 210 / 0.30)
    );
```

With:

```css
    --accent-gradient-wash: linear-gradient(
      120deg,
      rgba(255, 77, 77, 0.12) 0%,
      rgba(77, 124, 255, 0.10) 45%,
      rgba(255, 184, 77, 0.08) 100%
    );
    --accent-border-mesh: linear-gradient(
      135deg,
      rgba(255, 77, 77, 0.42),
      rgba(77, 124, 255, 0.35),
      rgba(255, 184, 77, 0.30)
    );
```

- [ ] **Step 6: Replace shadow and calendar tokens that reference lime**

Replace:

```css
    --shadow-card-hover: 0 8px 28px oklch(75% 0.22 130 / 0.22);
```

With:

```css
    --shadow-card-hover: 0 8px 28px rgba(255, 77, 77, 0.18);
```

Replace:

```css
    --calendar-today-bg: oklch(75% 0.22 130 / 0.12);
    --calendar-today-border: oklch(75% 0.22 130 / 0.35);
```

With:

```css
    --calendar-today-bg: rgba(77, 124, 255, 0.12);
    --calendar-today-border: rgba(77, 124, 255, 0.35);
```

- [ ] **Step 7: Replace mobile dock gradient**

Replace the mobile dock `background` that references lime oklch values:

```css
        oklch(75% 0.22 130 / 0.35),
        oklch(55% 0.14 200 / 0.22),
        oklch(65% 0.10 210 / 0.18)
```

With:

```css
        rgba(255, 77, 77, 0.30),
        rgba(77, 124, 255, 0.22),
        rgba(255, 184, 77, 0.18)
```

- [ ] **Step 8: Commit**

```bash
git add src/styles/tokens-home-dark.css
git commit -m "feat(theme): replace lime accents with red/blue/yellow in dark tokens"
```

---

### Task 2: Update Light Theme Tokens

**Files:**
- Modify: `src/styles/tokens-light.css`

- [ ] **Step 1: Replace accent colors**

Replace:

```css
    --accent-primary: #c4f24a;
    --accent-secondary: #9edb2f;
    --accent-tertiary: #7cb518;
    --accent-glow: oklch(75% 0.22 130 / 0.28);
    --accent-soft: oklch(75% 0.22 130 / 0.10);
```

With:

```css
    --accent-primary: #FF4D4D;
    --accent-secondary: #4D7CFF;
    --accent-tertiary: #FFB84D;
    --accent-glow: rgba(255, 77, 77, 0.28);
    --accent-soft: rgba(255, 77, 77, 0.10);
```

- [ ] **Step 2: Replace ambient blob tints**

Replace:

```css
    /* Ambient blobs — warm amber + lime (no blue, no purple) */
    --blob-tint-a: oklch(75% 0.22 130 / 0.14);    /* lime */
    --blob-tint-b: oklch(72% 0.16 80 / 0.12);     /* warm amber */
    --blob-tint-c: oklch(68% 0.12 70 / 0.10);     /* amber-orange */
    --blob-glow: oklch(75% 0.22 130 / 0.18);
    --ambient-lime: oklch(75% 0.22 130 / 0.10);
    --ambient-teal: oklch(55% 0.14 200 / 0.06);
    --ambient-amber: oklch(72% 0.16 80 / 0.10);
    /* Legacy aliases */
    --ambient-blue: var(--ambient-teal);
    --ambient-red: oklch(58% 0.18 25 / 0.05);
    --ambient-gold: var(--ambient-lime);
```

With:

```css
    /* Ambient blobs — red / blue / gold */
    --blob-tint-a: oklch(60% 0.22 25 / 0.10);     /* warm red */
    --blob-tint-b: oklch(55% 0.18 260 / 0.08);    /* blue */
    --blob-tint-c: oklch(72% 0.16 80 / 0.08);     /* amber gold */
    --blob-glow: oklch(60% 0.22 25 / 0.14);
    --ambient-red: oklch(60% 0.22 25 / 0.08);
    --ambient-blue: oklch(55% 0.18 260 / 0.06);
    --ambient-gold: oklch(72% 0.16 80 / 0.08);
```

- [ ] **Step 3: Replace gradient wash and border mesh**

Replace:

```css
    --accent-gradient-wash: linear-gradient(
      120deg,
      oklch(75% 0.22 130 / 0.10) 0%,
      oklch(72% 0.16 80 / 0.08) 45%,
      oklch(68% 0.12 70 / 0.07) 100%
    );
    --accent-border-mesh: linear-gradient(
      135deg,
      oklch(75% 0.22 130 / 0.40),
      oklch(72% 0.16 80 / 0.32),
      oklch(68% 0.12 70 / 0.28)
    );
```

With:

```css
    --accent-gradient-wash: linear-gradient(
      120deg,
      rgba(255, 77, 77, 0.10) 0%,
      rgba(77, 124, 255, 0.08) 45%,
      rgba(255, 184, 77, 0.07) 100%
    );
    --accent-border-mesh: linear-gradient(
      135deg,
      rgba(255, 77, 77, 0.40),
      rgba(77, 124, 255, 0.32),
      rgba(255, 184, 77, 0.28)
    );
```

- [ ] **Step 4: Replace shadow and calendar tokens**

Replace:

```css
    --shadow-card-hover: 0 8px 28px oklch(75% 0.22 130 / 0.18);
```

With:

```css
    --shadow-card-hover: 0 8px 28px rgba(255, 77, 77, 0.14);
```

Replace:

```css
    --calendar-today-bg: oklch(75% 0.22 130 / 0.12);
    --calendar-today-border: oklch(75% 0.22 130 / 0.28);
```

With:

```css
    --calendar-today-bg: rgba(77, 124, 255, 0.12);
    --calendar-today-border: rgba(77, 124, 255, 0.28);
```

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens-light.css
git commit -m "feat(theme): replace lime accents with red/blue/yellow in light tokens"
```

---

### Task 3: Add Animated Mesh Color-Shift Keyframes

**Files:**
- Modify: `src/styles/utilities-extra.css`

- [ ] **Step 1: Add the mesh-shift animation**

At the end of `src/styles/utilities-extra.css`, add:

```css
/* ── Animated mesh color shift ── */
@keyframes mesh-color-shift {
  0% {
    filter: blur(calc(72px * var(--mesh-blur-scale, 1))) hue-rotate(0deg);
  }
  33% {
    filter: blur(calc(72px * var(--mesh-blur-scale, 1))) hue-rotate(15deg);
  }
  66% {
    filter: blur(calc(72px * var(--mesh-blur-scale, 1))) hue-rotate(-10deg);
  }
  100% {
    filter: blur(calc(72px * var(--mesh-blur-scale, 1))) hue-rotate(0deg);
  }
}

.mesh-animate {
  animation: mesh-color-shift 20s ease-in-out infinite;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/styles/utilities-extra.css
git commit -m "feat(theme): add mesh color-shift animation keyframes"
```

---

### Task 4: Update Hardcoded Lime Fallbacks in Components

**Files:**
- Modify: `src/lib/components/DesktopSidebar.svelte`
- Modify: `src/lib/components/HomeContextRail.svelte`
- Modify: `src/lib/components/home/HeroIdentity.svelte`
- Modify: `src/lib/components/InferenceIdentityPanel.svelte`
- Modify: `src/lib/components/IdentityIntelligencePanel.svelte`
- Modify: `src/lib/components/HomeCurrentReadCard.svelte`

- [ ] **Step 1: Update DesktopSidebar.svelte**

In `src/lib/components/DesktopSidebar.svelte`, replace all 4 occurrences of `var(--home-lime, #b8f24a)` with `var(--home-accent, #FF4D4D)`:

Line 216: `color: var(--home-accent, #FF4D4D);`
Line 217: `background: color-mix(in srgb, var(--home-accent, #FF4D4D) 12%, transparent);`
Line 218: `border-color: color-mix(in srgb, var(--home-accent, #FF4D4D) 22%, transparent);`
Line 219: `box-shadow: 0 0 20px color-mix(in srgb, var(--home-accent, #FF4D4D) 25%, transparent);`

- [ ] **Step 2: Update HomeContextRail.svelte**

In `src/lib/components/HomeContextRail.svelte`, replace all 4 occurrences of `var(--home-lime, #b8f24a)` with `var(--home-accent, #FF4D4D)`:

Line 161: `color: var(--home-accent, #FF4D4D);`
Line 162: `background: color-mix(in srgb, var(--home-accent, #FF4D4D) 12%, transparent);`
Line 163: `border-color: color-mix(in srgb, var(--home-accent, #FF4D4D) 22%, transparent);`
Line 164: `box-shadow: 0 0 20px color-mix(in srgb, var(--home-accent, #FF4D4D) 25%, transparent);`

- [ ] **Step 3: Update HeroIdentity.svelte**

In `src/lib/components/home/HeroIdentity.svelte`, replace all 3 occurrences of `var(--accent-primary, #c4f24a)` with `var(--accent-primary, #FF4D4D)`:

Line 177, 223, 265.

- [ ] **Step 4: Update InferenceIdentityPanel.svelte**

In `src/lib/components/InferenceIdentityPanel.svelte`:

Line 688: Replace `var(--home-lime, #b8f24a)` with `var(--home-accent, #FF4D4D)`
Line 858: Replace `var(--home-lime, #b8f24a)` with `var(--home-accent, #FF4D4D)`

- [ ] **Step 5: Update IdentityIntelligencePanel.svelte**

In `src/lib/components/IdentityIntelligencePanel.svelte`:

Line 439: Replace `var(--home-lime, #b8f24a)` with `var(--home-accent, #FF4D4D)`

- [ ] **Step 6: Update HomeCurrentReadCard.svelte**

In `src/lib/components/HomeCurrentReadCard.svelte`:

Line 126: Replace `linear-gradient(90deg, #c4f24a, #22d3ee)` with `linear-gradient(90deg, #FF4D4D, #4D7CFF)`

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/DesktopSidebar.svelte src/lib/components/HomeContextRail.svelte src/lib/components/home/HeroIdentity.svelte src/lib/components/InferenceIdentityPanel.svelte src/lib/components/IdentityIntelligencePanel.svelte src/lib/components/HomeCurrentReadCard.svelte
git commit -m "feat(theme): update hardcoded lime fallbacks to red/blue/yellow"
```

---

### Task 5: Create ProductPreviewCard Component

**Files:**
- Create: `src/lib/components/onboarding/ProductPreviewCard.svelte`

- [ ] **Step 1: Create the component**

Create `src/lib/components/onboarding/ProductPreviewCard.svelte`:

```svelte
<script lang="ts">
  export let variant: 'identity' | 'recommendation' | 'chat' | 'calendar' | 'instagram' | 'match-score';
</script>

<div class="preview-card">
  {#if variant === 'identity'}
    <div class="preview-label">Identity Graph</div>
    <div class="preview-body">
      <div class="preview-avatar">M</div>
      <div class="preview-name">Madhvik Nemani</div>
      <div class="preview-city">Mumbai</div>
      <div class="preview-tags">
        <span class="ptag ptag--red">Music</span>
        <span class="ptag ptag--blue">Nightlife</span>
        <span class="ptag ptag--gold">Food</span>
        <span class="ptag ptag--red">Travel</span>
        <span class="ptag ptag--blue">Fitness</span>
      </div>
      <div class="preview-domains">
        <div class="preview-domain">
          <span class="pd-label">Music taste</span>
          <div class="pd-bar"><div class="pd-fill pd-fill--red" style="width:92%"></div></div>
        </div>
        <div class="preview-domain">
          <span class="pd-label">Social life</span>
          <div class="pd-bar"><div class="pd-fill pd-fill--blue" style="width:78%"></div></div>
        </div>
        <div class="preview-domain">
          <span class="pd-label">Food & dining</span>
          <div class="pd-bar"><div class="pd-fill pd-fill--gold" style="width:85%"></div></div>
        </div>
      </div>
      <div class="preview-aesthetic">"Warm minimalist with a love for late-night jazz bars"</div>
    </div>

  {:else if variant === 'recommendation'}
    <div class="preview-label">Personalized Picks</div>
    <div class="preview-body">
      <div class="preview-rec-card">
        <div class="prec-header">
          <span class="prec-cat">Restaurant</span>
          <span class="prec-match">92% match</span>
        </div>
        <div class="prec-title">Bombay Canteen</div>
        <div class="prec-desc">Modern Indian, craft cocktails, live music Fridays</div>
        <div class="prec-sources">
          <span class="prec-src">Instagram</span>
          <span class="prec-src">Spotify</span>
        </div>
      </div>
      <div class="preview-rec-card preview-rec-card--dim">
        <div class="prec-header">
          <span class="prec-cat">Event</span>
          <span class="prec-match">87% match</span>
        </div>
        <div class="prec-title">Magnetic Fields Festival</div>
        <div class="prec-desc">Electronic music, art installations, Rajasthan</div>
      </div>
    </div>

  {:else if variant === 'chat'}
    <div class="preview-label">AI Assistant</div>
    <div class="preview-body preview-body--chat">
      <div class="pchat-user">What should I do this weekend?</div>
      <div class="pchat-ai">Based on your taste, here are my picks:</div>
      <div class="pchat-cards">
        <div class="pchat-card">
          <span class="pchat-emoji">&#127869;</span>
          <span>Bastian — seafood + cocktails</span>
        </div>
        <div class="pchat-card">
          <span class="pchat-emoji">&#127926;</span>
          <span>Jazz at Blue Tokai, 8pm</span>
        </div>
        <div class="pchat-card">
          <span class="pchat-emoji">&#127911;</span>
          <span>Your Discover Weekly is fire</span>
        </div>
      </div>
    </div>

  {:else if variant === 'calendar'}
    <div class="preview-label">Schedule Insights</div>
    <div class="preview-body">
      <div class="pcal-item">
        <div class="pcal-time">10:00</div>
        <div class="pcal-event pcal-event--blue">Team standup</div>
      </div>
      <div class="pcal-item">
        <div class="pcal-time">14:00</div>
        <div class="pcal-event pcal-event--gold">Lunch with Rohan @ Bastian</div>
      </div>
      <div class="pcal-item">
        <div class="pcal-time">19:30</div>
        <div class="pcal-event pcal-event--red">Jazz night (suggested)</div>
      </div>
    </div>

  {:else if variant === 'instagram'}
    <div class="preview-label">Extracted Signals</div>
    <div class="preview-body">
      <div class="pig-row">
        <span class="pig-label">Aesthetic</span>
        <span class="pig-value">"warm minimalist"</span>
      </div>
      <div class="pig-row">
        <span class="pig-label">Interests</span>
        <div class="preview-tags" style="margin-top:4px;">
          <span class="ptag ptag--red">Music</span>
          <span class="ptag ptag--gold">Food</span>
          <span class="ptag ptag--blue">Travel</span>
        </div>
      </div>
      <div class="pig-row">
        <span class="pig-label">Vibe</span>
        <span class="pig-value">Late-night, cultural, creative</span>
      </div>
    </div>

  {:else if variant === 'match-score'}
    <div class="preview-label">Signal Strength</div>
    <div class="preview-body preview-body--scores">
      <div class="pscore">
        <div class="pscore-ring pscore-ring--low">72%</div>
        <div class="pscore-label">Phone only</div>
      </div>
      <div class="pscore-arrow">&#8594;</div>
      <div class="pscore">
        <div class="pscore-ring pscore-ring--mid">89%</div>
        <div class="pscore-label">+ Google</div>
      </div>
      <div class="pscore-arrow">&#8594;</div>
      <div class="pscore">
        <div class="pscore-ring pscore-ring--high">95%</div>
        <div class="pscore-label">+ Instagram</div>
      </div>
    </div>
  {/if}
</div>

<style>
  .preview-card {
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 16px;
    backdrop-filter: blur(var(--blur-medium));
    overflow: hidden;
  }

  .preview-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 12px;
  }

  .preview-body { display: flex; flex-direction: column; gap: 8px; }
  .preview-body--chat { gap: 10px; }
  .preview-body--scores { flex-direction: row; align-items: center; justify-content: center; gap: 12px; }

  /* Identity variant */
  .preview-avatar {
    width: 40px; height: 40px; border-radius: 50%;
    background: linear-gradient(135deg, #FF4D4D, #FFB84D);
    display: flex; align-items: center; justify-content: center;
    font-size: 16px; font-weight: 800; color: white;
    margin-bottom: 4px;
  }
  .preview-name { font-size: 15px; font-weight: 700; color: var(--text-primary); }
  .preview-city { font-size: 12px; color: var(--text-muted); margin-top: -4px; }
  .preview-tags { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 4px; }
  .ptag {
    font-size: 10px; padding: 3px 8px; border-radius: 100px; font-weight: 600;
  }
  .ptag--red { background: rgba(255,77,77,0.12); color: #FF6B6B; border: 1px solid rgba(255,77,77,0.25); }
  .ptag--blue { background: rgba(77,124,255,0.12); color: #6B9AFF; border: 1px solid rgba(77,124,255,0.25); }
  .ptag--gold { background: rgba(255,184,77,0.12); color: #FFC46B; border: 1px solid rgba(255,184,77,0.25); }

  .preview-domains { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
  .preview-domain { display: flex; align-items: center; gap: 8px; }
  .pd-label { font-size: 11px; color: var(--text-muted); width: 80px; flex-shrink: 0; }
  .pd-bar { flex: 1; height: 4px; border-radius: 2px; background: var(--glass-medium); }
  .pd-fill { height: 100%; border-radius: 2px; }
  .pd-fill--red { background: #FF4D4D; }
  .pd-fill--blue { background: #4D7CFF; }
  .pd-fill--gold { background: #FFB84D; }

  .preview-aesthetic {
    font-size: 11px; color: var(--text-secondary); font-style: italic; margin-top: 4px;
  }

  /* Recommendation variant */
  .preview-rec-card {
    background: var(--glass-medium); border-radius: 12px; padding: 12px;
    border: 1px solid var(--border-subtle);
  }
  .preview-rec-card--dim { opacity: 0.6; }
  .prec-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .prec-cat {
    font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em;
    color: var(--accent-secondary); /* blue */
  }
  .prec-match {
    font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 100px;
    background: rgba(255,77,77,0.12); color: #FF6B6B; border: 1px solid rgba(255,77,77,0.25);
  }
  .prec-title { font-size: 14px; font-weight: 700; color: var(--text-primary); }
  .prec-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
  .prec-sources { display: flex; gap: 6px; margin-top: 8px; }
  .prec-src {
    font-size: 9px; font-weight: 600; padding: 2px 6px; border-radius: 100px;
    background: var(--glass-light); color: var(--text-muted); border: 1px solid var(--border-subtle);
  }

  /* Chat variant */
  .pchat-user {
    align-self: flex-end; background: var(--glass-medium); border-radius: 14px 14px 4px 14px;
    padding: 10px 14px; font-size: 13px; color: var(--text-primary); max-width: 80%;
    border: 1px solid var(--border-subtle);
  }
  .pchat-ai {
    font-size: 13px; color: var(--text-secondary);
  }
  .pchat-cards { display: flex; flex-direction: column; gap: 6px; }
  .pchat-card {
    display: flex; align-items: center; gap: 8px; padding: 8px 12px;
    background: var(--glass-medium); border-radius: 10px;
    font-size: 12px; color: var(--text-primary);
    border: 1px solid var(--border-subtle);
  }
  .pchat-emoji { font-size: 16px; }

  /* Calendar variant */
  .pcal-item { display: flex; align-items: center; gap: 10px; }
  .pcal-time { font-size: 11px; color: var(--text-muted); font-family: var(--font-mono); width: 36px; }
  .pcal-event {
    flex: 1; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 500;
  }
  .pcal-event--blue { background: rgba(77,124,255,0.12); color: #6B9AFF; border-left: 3px solid #4D7CFF; }
  .pcal-event--gold { background: rgba(255,184,77,0.12); color: #FFC46B; border-left: 3px solid #FFB84D; }
  .pcal-event--red { background: rgba(255,77,77,0.12); color: #FF6B6B; border-left: 3px solid #FF4D4D; }

  /* Instagram variant */
  .pig-row { display: flex; flex-direction: column; gap: 2px; }
  .pig-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted); }
  .pig-value { font-size: 13px; color: var(--text-secondary); font-style: italic; }

  /* Match score variant */
  .pscore { display: flex; flex-direction: column; align-items: center; gap: 4px; }
  .pscore-ring {
    width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
    font-size: 13px; font-weight: 800; font-family: var(--font-mono);
  }
  .pscore-ring--low { background: rgba(255,77,77,0.12); color: #FF6B6B; border: 2px solid rgba(255,77,77,0.35); }
  .pscore-ring--mid { background: rgba(255,184,77,0.12); color: #FFC46B; border: 2px solid rgba(255,184,77,0.35); }
  .pscore-ring--high { background: rgba(77,124,255,0.12); color: #6B9AFF; border: 2px solid rgba(77,124,255,0.35); }
  .pscore-label { font-size: 10px; color: var(--text-muted); }
  .pscore-arrow { font-size: 16px; color: var(--text-muted); }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/components/onboarding/ProductPreviewCard.svelte
git commit -m "feat: add ProductPreviewCard component with 6 variants"
```

---

### Task 6: Redesign Landing Page with Product Visuals + Animated Mesh

**Files:**
- Modify: `src/routes/+page.svelte`

- [ ] **Step 1: Rewrite the landing page**

Replace the entire content of `src/routes/+page.svelte` with the new version that:
1. Adds `mesh-animate` class to gradient orbs for the color-shift animation
2. Replaces text-only feature cards with `ProductPreviewCard` components
3. Uses the new gradient CTA (`linear-gradient(135deg, #FF4D4D, #FFB84D)`)
4. Fixes the splash loader to use the new gradient (not purple)

Full replacement for `src/routes/+page.svelte`:

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount, onDestroy } from 'svelte';
  import { profile, type UserProfile } from '$lib/stores/profile';
  import { get } from 'svelte/store';
  import {
    isAppSessionValid,
    maybeRepairIgOnlyAccountKey,
  } from '$lib/auth/sessionGate';
  import ProductPreviewCard from '$lib/components/onboarding/ProductPreviewCard.svelte';

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
            body: JSON.stringify({ googleSub: repaired.googleSub, profile: repaired, tokens: {} }),
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
    <div class="landing-g landing-g--a mesh-animate" bind:this={g1}></div>
    <div class="landing-g landing-g--b mesh-animate" bind:this={g2}></div>
    <div class="landing-g landing-g--c mesh-animate" bind:this={g3}></div>
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

    <div class="landing-section-label">See what you'll get</div>

    <div class="landing-previews">
      <div class="landing-preview-item">
        <ProductPreviewCard variant="identity" />
        <p class="landing-preview-caption">Your identity, extracted from your real digital footprint</p>
      </div>
      <div class="landing-preview-item">
        <ProductPreviewCard variant="recommendation" />
        <p class="landing-preview-caption">Recommendations tuned to who you actually are</p>
      </div>
      <div class="landing-preview-item">
        <ProductPreviewCard variant="chat" />
        <p class="landing-preview-caption">An AI assistant that already knows your taste</p>
      </div>
    </div>
  </div>
</div>
{:else}
<div style="flex:1; display:flex; align-items:center; justify-content:center;">
  <div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#FF4D4D,#FFB84D);display:flex;align-items:center;justify-content:center;font-size:22px;" class="pulse-glow">
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
    min-height: 70dvh;
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
    background: linear-gradient(135deg, #FF4D4D, #FFB84D);
    border: none;
    color: white;
    font-size: 16px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    box-shadow: 0 4px 24px rgba(255, 77, 77, 0.3);
    transition: transform 0.15s, opacity 0.15s;
  }
  .landing-cta:active { transform: scale(0.97); }

  .landing-section-label {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 20px;
  }

  .landing-previews {
    display: grid;
    grid-template-columns: 1fr;
    gap: 24px;
    padding-bottom: max(48px, env(safe-area-inset-bottom, 48px));
  }

  .landing-preview-item { display: flex; flex-direction: column; gap: 10px; }

  .landing-preview-caption {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.5;
    margin: 0;
  }

  @media (min-width: 768px) {
    .landing-content {
      max-width: 54rem;
      margin: 0 auto;
      width: 100%;
    }
    .landing-previews {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/+page.svelte
git commit -m "feat: redesign landing page with product preview cards + animated mesh"
```

---

### Task 7: Enhance Onboarding with Explanatory Content

**Files:**
- Modify: `src/routes/onboarding/+page.svelte`

- [ ] **Step 1: Add ProductPreviewCard import**

At the top of the `<script>` block, after the existing imports, add:

```typescript
  import ProductPreviewCard from '$lib/components/onboarding/ProductPreviewCard.svelte';
```

- [ ] **Step 2: Enhance Step 0 (Phone + OTP)**

In the Step 0 template, after the phone input `<div class="ob-phone-field">...</div>` block (inside the `{#if !wagwanOtpSent}` branch), add an unlock preview card before `<div class="ob-bottom">`:

```svelte
        <div class="ob-unlock-card">
          <div class="ob-unlock-title">Here's what you'll unlock</div>
          <div class="ob-unlock-items">
            <div class="ob-unlock-item">
              <span class="ob-unlock-dot ob-unlock-dot--red"></span>
              <span>Identity insights from your platforms</span>
            </div>
            <div class="ob-unlock-item">
              <span class="ob-unlock-dot ob-unlock-dot--blue"></span>
              <span>Personalized recommendations</span>
            </div>
            <div class="ob-unlock-item">
              <span class="ob-unlock-dot ob-unlock-dot--gold"></span>
              <span>AI assistant that knows you</span>
            </div>
          </div>
        </div>
```

- [ ] **Step 3: Enhance Step 1 (Google OAuth)**

In the Step 1 template, after `<p class="ob-sub">Connect Google or Instagram to get started. You can add the other later.</p>`, add:

```svelte
      <div class="ob-explain-card">
        <ProductPreviewCard variant="calendar" />
        <p class="ob-explain-text">Your calendar reveals your schedule, inbox shows your priorities, YouTube reflects your interests.</p>
      </div>
```

- [ ] **Step 4: Enhance Step 2 (Instagram OAuth)**

In the Step 2 template, after the `<p class="ob-sub">` block (around line with "Instagram is optional but sharpens..."), add:

```svelte
      <div class="ob-explain-card">
        <ProductPreviewCard variant="instagram" />
        <p class="ob-explain-text">Your posts reveal your aesthetic, food taste, and lifestyle signals — this is how we really get you.</p>
      </div>
```

- [ ] **Step 5: Enhance Step 3 (Optional Signals)**

In the Step 3 template, after `<p class="ob-sub">You can always add these later from your profile.</p>`, add:

```svelte
      <div class="ob-explain-card">
        <ProductPreviewCard variant="match-score" />
        <p class="ob-explain-text">Every platform you connect sharpens your recommendations and match scores.</p>
      </div>
```

- [ ] **Step 6: Update onboarding CTA gradient**

In the `<style>` block, update the `.ob-cta` background. Replace:

```css
    background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
```

With:

```css
    background: linear-gradient(135deg, #FF4D4D, #FFB84D);
```

- [ ] **Step 7: Add mesh-animate class to gradient orbs**

In the template, update the gradient orbs to add the animation class:

Replace:
```svelte
    <div class="ob-g ob-g--a" bind:this={g1}></div>
    <div class="ob-g ob-g--b" bind:this={g2}></div>
    <div class="ob-g ob-g--c" bind:this={g3}></div>
```

With:
```svelte
    <div class="ob-g ob-g--a mesh-animate" bind:this={g1}></div>
    <div class="ob-g ob-g--b mesh-animate" bind:this={g2}></div>
    <div class="ob-g ob-g--c mesh-animate" bind:this={g3}></div>
```

- [ ] **Step 8: Add styles for new onboarding elements**

In the `<style>` block, after the existing `.ob-change-link:hover` styles, add:

```css
  /* Unlock preview card (Step 0) */
  .ob-unlock-card {
    margin-top: 24px;
    background: var(--glass-light);
    border: 1px solid var(--border-subtle);
    border-radius: 16px;
    padding: 16px;
    backdrop-filter: blur(var(--blur-light));
  }
  .ob-unlock-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
    margin-bottom: 12px;
  }
  .ob-unlock-items { display: flex; flex-direction: column; gap: 10px; }
  .ob-unlock-item {
    display: flex; align-items: center; gap: 10px;
    font-size: 13px; color: var(--text-secondary);
  }
  .ob-unlock-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
  }
  .ob-unlock-dot--red { background: #FF4D4D; }
  .ob-unlock-dot--blue { background: #4D7CFF; }
  .ob-unlock-dot--gold { background: #FFB84D; }

  /* Explain cards (Steps 1-3) */
  .ob-explain-card {
    margin-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .ob-explain-text {
    font-size: 12px;
    color: var(--text-muted);
    line-height: 1.5;
    margin: 0;
  }
```

- [ ] **Step 9: Commit**

```bash
git add src/routes/onboarding/+page.svelte
git commit -m "feat(onboarding): add explanatory content + product preview cards"
```

---

### Task 8: Build and Verify

**Files:** None (verification only)

- [ ] **Step 1: Type-check**

```bash
cd /Users/madhviknemani/wagwan-ai && npx svelte-kit sync && npx svelte-check --tsconfig ./tsconfig.json 2>&1 | tail -20
```

Expected: No new errors (pre-existing ones are fine).

- [ ] **Step 2: Build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 3: Start dev server and test**

```bash
npm run dev
```

Test:
1. Open `http://localhost:5173/` — landing page should show product preview cards (identity, recommendation, chat) with red/blue/gold accents. Mesh orbs should slowly shift color.
2. Click "Get Started" → onboarding Step 0 should show "unlock" card with colored dots.
3. Step 1 should show calendar preview card explaining why Google matters.
4. Step 2 should show Instagram extracted signals preview.
5. Step 3 should show match score progression.
6. Navigate to `/home` (with a valid session) — verify the sidebar, nav dock, and cards all use red/blue/gold accents instead of lime.

- [ ] **Step 4: Commit any fixes**

```bash
git add -u
git commit -m "fix: resolve issues from theme overhaul smoke testing"
```
