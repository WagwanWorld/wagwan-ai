# Micro-Creator Landing & Onboarding Redesign

**Date:** 2026-04-16
**Status:** Design approved

---

## Problem

The current landing page pitches Wagwan as "Your identity, understood" — an introspective personal-twin angle. The onboarding is a 5-step wizard focused on connecting platforms to build an identity profile. Neither surfaces the core incentive for micro-creators: **getting paid to post**.

The target user is an everyday Instagram user (1K–10K followers) who posts about their life, food, and travel but doesn't think of themselves as a "creator." They don't know they can earn from what they already do.

## Goal

Reframe the landing and onboarding experience around the earning/automation value prop:
- **Distribution is the key** — Wagwan makes it simple for anyone to become a micro-creator
- **Automation** — auto-matching with brands, content suggestions, auto-analytics, auto-reporting
- **Low friction** — sign up with Google + Instagram on a single screen, straight into the app

## Design

### 1. Landing Page — Hero (Full Viewport)

Full viewport, dark, center-aligned. Existing animated mesh gradient backdrop.

**Content stack (vertically centered):**
1. Wagwan logo (small, top)
2. **Headline** — large bold Geist Sans: "Post. Get paid. Your AI handles the rest."
3. **Subtext** — one line, `--text-secondary`: "Wagwan matches you with brands, auto-posts your content, and handles analytics. You just keep being you."
4. **Two auth buttons** — glass-panel style (`--glass-medium`, `backdrop-blur(12px)`), side-by-side on desktop, stacked on mobile:
   - "Continue with Google" (Google icon)
   - "Continue with Instagram" (Instagram icon)
   - Red→gold gradient on hover
5. **Trust line** — small, `--text-muted`: "Join micro-creators already earning"

**No navbar, no links, no hamburger.** Just the pitch and the action.

**Design reference:** 21st.dev — generous whitespace, max 2 font sizes on screen, high-contrast headline against dark bg, subtle hover animations (scale + glow), no clutter.

### 2. Below the Fold — Value Props

Three cards in a horizontal row (stacks vertically on mobile). Glass surface cards with icon + headline + one-line description.

**Card 1: "Auto-matched"**
- Icon: magnet/link (Phosphor)
- "Brands find you based on your vibe, not your follower count."

**Card 2: "Auto-posted"**
- Icon: lightning bolt (Phosphor)
- "Content suggestions ready to go. Approve and it's live."

**Card 3: "Auto-reported"**
- Icon: chart/analytics (Phosphor)
- "Analytics packaged and sent to brands. You don't touch a thing."

**Styling:** `--glass-light` background, `backdrop-blur(12px)`, subtle border, Phosphor icons. Staggered fade-in on scroll. Generous gap between cards.

**That's the entire landing page — hero + three cards. Nothing else.**

### 3. Onboarding — Single Page Auth

No separate onboarding page. After clicking an auth button on the landing page, the hero transitions in-place:

- Headline fades out, auth card expands into center of screen
- **Auth card (glass panel, centered):**
  - User's profile picture + name appears after first auth completes
  - Both auth buttons shown — completed one shows checkmark + connected state
  - The other button pulses subtly to prompt connection
  - Once both connected, CTA appears: **"Start earning"** (red→gold gradient)

**On "Start earning":**
- Instagram identity extraction runs in background (existing `/api/instagram/identity`)
- Profile saved to Supabase (existing `/api/profile/save`)
- Redirect to `/home`

**Dropped from old 5-step flow:**
- Steps 3–4: Spotify, LinkedIn, YouTube, Apple Music, identity review, budget, city — all move to `/profile` settings for later enrichment
- Step 5: Starter chips — home page already has these

**Kept:** Google auth, Instagram auth, identity extraction.

### 4. Home Page

**No changes.** Stays identity-focused as-is.

### 5. Earn Page (`/earn`)

New page, accessible from existing bottom nav (FloatingNav) and sidebar (DesktopSidebar) — both already have the Earn tab wired up.

**Layout (single scroll):**

1. **Status banner** — glass panel, full width
   - "You're live in the marketplace" + green dot (if Instagram connected)
   - Or "Connect Instagram to start earning" (if not connected)

2. **Match stats** — three inline metrics
   - "Profile views from brands" — number
   - "Matches this week" — number
   - "Lifetime earnings" — ₹ amount (₹0 is fine, sets expectation)

3. **Active campaigns** — list of matched/approved campaigns
   - Each card: brand logo/name, brief description, status (matched / approved / posted / paid)
   - Empty state: "No campaigns yet. We're finding brands that match your vibe."

4. **How it works** — three-step minimal explainer
   - "We match you" → "You approve & post" → "We report, you earn"

**Styling:** dark, glass panels, Geist, existing design tokens. No new patterns.

## Out of Scope

- No changes to the brand portal
- No changes to AI chat, explore, or profile pages
- No new API endpoints — uses existing auth + identity extraction
- No changes to design system tokens or typography
- Optional signal connections (Spotify, LinkedIn, etc.) can be migrated to profile settings later — not in this scope
- No actual payment/payout system — earn page shows status and metrics only

## Tech Notes

- **Framework:** SvelteKit (no Next.js — staying in the existing stack)
- **Design reference:** 21st.dev component patterns replicated in Svelte
- **Auth:** Existing Google + Instagram OAuth flows
- **Styling:** Tailwind + existing CSS token system (OKLCH)
- **Icons:** Phosphor Svelte (already installed)
- **Animations:** CSS transitions + existing mesh gradient system
