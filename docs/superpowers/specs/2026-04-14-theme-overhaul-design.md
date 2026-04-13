# Theme Overhaul + Onboarding Enhancement Design

**Date:** 2026-04-14
**Goal:** Replace the acid-lime accent with a vibrant red/blue/yellow gradient system across the entire app, redesign the landing page with product visual cards, and enhance onboarding with explanatory content showing users what they'll get.

---

## 1. New Color System

Replace all `#c4f24a` lime accents with a multi-color gradient palette:

### Primary Accents
- **Red**: `#FF4D4D` — warm, energetic (primary action color)
- **Blue**: `#4D7CFF` — bright, trustworthy (secondary accent)
- **Yellow/Amber**: `#FFB84D` — warm gold, optimistic (tertiary highlight)

### Gradient Definitions
- **CTA gradient**: `linear-gradient(135deg, #FF4D4D, #FFB84D)` (red → gold)
- **Accent gradient wash** (ambient): `linear-gradient(120deg, rgba(77,124,255,0.12), rgba(255,77,77,0.10), rgba(255,184,77,0.08))`
- **Accent border mesh**: `linear-gradient(135deg, rgba(77,124,255,0.42), rgba(255,77,77,0.35), rgba(255,184,77,0.30))`
- **Home accent gradient**: `linear-gradient(90deg, #FF4D4D 0%, #4D7CFF 50%, #FFB84D 100%)`

### Token Mapping
```
--accent-primary:   #FF4D4D
--accent-secondary: #4D7CFF
--accent-tertiary:  #FFB84D
--accent-glow:      rgba(255, 77, 77, 0.32)
--accent-soft:      rgba(255, 77, 77, 0.12)
```

### Ambient Mesh Orbs (replace lime/teal)
```
--ambient-blue:  oklch(55% 0.20 260 / 0.15)   (blue)
--ambient-red:   oklch(60% 0.22 25 / 0.12)     (warm red)
--ambient-gold:  oklch(72% 0.16 80 / 0.10)     (amber/gold)
```

### Moving Gradient
Add a CSS `@keyframes` animation on the ambient mesh that slowly rotates hue/position over ~20 seconds, cycling emphasis between red, blue, and gold tints. Applied via `animation` on the mesh orb elements.

### Dark backgrounds stay
The `oklch(8% 0.008 260)` blue-black backgrounds remain — they're a good neutral canvas for vibrant accents.

---

## 2. Landing Page Redesign

Replace the current text-only feature cards with product visual cards built as styled Svelte components.

### Hero
- "wagwan" logo mark
- "Your identity, understood." headline in Bodoni Moda italic
- Subtitle explaining the product
- "Get Started" CTA with new red→gold gradient
- Animated mesh background using new palette with slow color-shift animation

### Product Visual Cards (3 cards)

**Card 1: "Your Identity Graph"**
- Glass panel containing a mock identity view
- Shows: user avatar placeholder, name, city, 5-6 interest tags (Music, Food, Nightlife, Travel, Fitness, Style), confidence bars for 3 domains, an "aesthetic" quote
- Labels: "Identity extracted from your platforms"

**Card 2: "Personalized Picks"**
- Glass panel containing a mock recommendation card
- Shows: a card with title, category tag, match score badge ("92% match"), description snippet, source tags (Instagram + Spotify)
- Labels: "Tuned to who you are"

**Card 3: "Ask Anything"**
- Glass panel containing a mock chat exchange
- Shows: a user message bubble ("What should I do this weekend?"), an AI response with 2-3 inline result cards (restaurant, event, playlist)
- Labels: "Your AI that knows you"

Cards use the existing glass panel system (`--glass-light`, `--border-subtle`, `backdrop-filter: blur`).

---

## 3. Onboarding Enhancement

### Step 0: Phone + OTP (enhanced)
- Keep the phone input and OTP flow
- Add a glass panel below the input showing "Here's what you'll unlock:" with 3 mini items:
  - Icon + "Identity insights from your platforms"
  - Icon + "Personalized recommendations"
  - Icon + "AI assistant that knows you"

### Step 1: Google OAuth (enhanced)
- Keep the connect buttons
- Add an explanatory glass card above the buttons:
  - Headline: "Why Google?"
  - Body: "Your calendar reveals your schedule, inbox shows your priorities, YouTube reflects your interests."
  - Mini visual: a styled mock showing calendar event cards + inbox category tags

### Step 2: Instagram OAuth (enhanced)
- Keep the connect button
- Add explanatory card:
  - Headline: "Why Instagram?"
  - Body: "Your posts reveal your aesthetic, food taste, nightlife, and lifestyle signals."
  - Mini visual: a styled mock showing extracted tags (aesthetic: "warm minimalist", interests: Music, Food, Travel)

### Step 3: Optional Signals (enhanced)
- Keep the signal cards
- Add a header card:
  - "The more signals, the better your match scores"
  - Mini visual: a match score badge going from 72% → 89% → 95% as more platforms connect

### Step 4: Identity Snapshot
- Use the new gradient accents on the identity card
- Gradient border on the card using `--accent-border-mesh`

### Step 5: Ready
- Use new gradient on the glow effect
- "Start exploring" CTA with red→gold gradient

---

## 4. ProductPreviewCard Component

Create a reusable component for the mock product visuals used in landing + onboarding.

**Props:**
- `variant`: 'identity' | 'recommendation' | 'chat' | 'calendar' | 'instagram' | 'match-score'
- Each variant renders a different styled mock

**Styling:**
- Glass panel with `--glass-light` background
- `backdrop-filter: blur(var(--blur-medium))`
- Border: `1px solid var(--border-subtle)`
- Border-radius: 16px
- All content is hardcoded mock data (not real user data)
- Uses the new gradient accents for highlights

---

## 5. Files to Change

| Action | File | What |
|--------|------|------|
| Modify | `src/styles/tokens-home-dark.css` | Replace all lime with red/blue/yellow palette + animated gradient keyframes |
| Modify | `src/styles/tokens-light.css` | Same accent overhaul |
| Modify | `src/routes/+page.svelte` | Landing page with product visual cards + animated mesh |
| Modify | `src/routes/onboarding/+page.svelte` | Explanatory content, preview cards, new gradient colors |
| Create | `src/lib/components/onboarding/ProductPreviewCard.svelte` | Mock product visual card component |

---

## 6. What Does NOT Change

- Dark background colors (`--bg-primary`, `--bg-secondary`, `--bg-elevated`)
- Layout system, typography, fonts
- Component structure (DesktopSidebar, FloatingNav, etc.)
- Glass panel system (just the accent colors within them)
- Any functional logic (auth, API calls, data flow)
