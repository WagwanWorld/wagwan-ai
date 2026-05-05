# Landing Page Portal Redesign

**Date:** 2026-05-05
**Status:** Approved
**File:** `src/routes/+page.svelte`

## Problem

The current landing page has two UX issues:

1. The creator/brand role toggle feels like a settings control, not a meaningful fork-in-the-road decision.
2. After picking a role, content appears flatly — no sense of crossing a threshold into a different world.

Additionally, the "Distribution hub" subtitle in the nav should be removed.

## Design

### Existing aesthetic (unchanged)

- Dark gradient background (`#030306` → `#0b0710` → `#1b0817`)
- Lime (`#c4f24a`) and magenta (`#ff4d97`) accent colors
- Floating orbs with blur, scan-line grain overlay
- `--font-display`, `--font-sans`, `--font-mono` type stack
- All existing OAuth/auth logic (Instagram connect, cookie handling, `finishCreatorSetup()`, profile store)

### Phase 1: The Choice (initial load)

Full viewport, vertically centered layout:

1. **Wagwan logo** — white SVG, centered, no subtitle text
2. **Headline** — "Every creator gets discovered. Every brand finds culture fit."
3. **Two choice cards** side by side (stacked on mobile):
   - **Creator card**: lime accent border glow/shadow, "I am a Creator" label, 1-line teaser ("Get discovered by brands that match your signal"), subtle lime orb behind
   - **Brand card**: magenta accent border glow/shadow, "I am a Brand" label, 1-line teaser ("Find creators by culture fit, not follower count"), magenta orb behind
4. **Card idle animation**: gentle float (`translateY` oscillating ~4px over 4s ease-in-out infinite)
5. **Card hover**: lift slightly (translateY -4px), border glow intensifies, sibling card dims to ~60% opacity
6. **Background**: same dark gradient + grain + drifting orbs

### Phase 2: Portal Transition (on click)

Timeline ~700ms total:

1. **Chosen card scales up** to fill viewport (~600ms, ease-out). Border glow intensifies during scale.
2. **Unchosen card fades + slides away** — opacity 0, translateX away from center (~400ms).
3. **Headline and logo fade up and out** — translateY -20px, opacity 0 (~300ms).
4. **Background orbs shift** — chosen role's orb increases opacity, other dims (~600ms transition).
5. **Expanding card dissolves** — once at full viewport, card shell (border/background) fades to transparent, merging with page background.

**Reduced motion:** All transforms become instant opacity swaps.

### Phase 3: The World (post-choice reveal)

Staggered fade-ins, each element delays ~100ms after previous:

1. **Nav** — wagwan logo slides down from top. Small role pill next to it (lime "Creator" or magenta "Brand"). "Switch" text link on the opposite side to return to choice screen.
2. **Hero copy** — role headline + body text, centered.
3. **CTA button** — Instagram connect (creator) or brand portal button. Same `primary-action` styling with role accent color.
4. **Trust note** — muted text below CTA.
5. **Preview cards** — 2-3 floating cards (wallet, brief, portrait) fade in with slight upward drift. A taste of what's inside, not the full value/bridge/CTA sections.

### Switch behavior

Clicking "Switch" reverses the transition:

- Post-choice content fades out
- Background orbs reset
- Choice screen returns with both cards visible
- No full page reload, purely client-side state toggle

## Removed elements

- "Distribution hub" text from nav
- Role toggle switch (replaced by two choice cards)
- Value cards section (5-card grid per role)
- Bridge section ("How the hub distributes opportunity" + 4 steps)
- Final CTA section at bottom
- `roleCopy.eyebrow` and `roleCopy.label` fields (unused after removal)

## Preserved elements

- All Instagram OAuth flow (`startCreatorInstagram`, callback handling, `finishCreatorSetup`)
- Brand Instagram redirect (`startPrimaryAction` for brand role)
- `profile` store integration
- `igIdentity`, `igToken`, `igConnecting`, `finishing`, `authError` state
- Cookie/param utilities (`readCookie`, `clearCookie`, `cleanParam`)
- `onMount` logic for OAuth callback params
- `reducedMotion` detection and respect
- Floating preview cards (wallet, brief, portrait) — content unchanged, just fewer shown
- `<svelte:head>` meta tags (updated title from "Join Wagwan" to "Wagwan")

## Scope

This is a single-file change to `src/routes/+page.svelte`. No new components, no new routes, no backend changes. All work is HTML structure, CSS, and Svelte reactive state within the existing file.
