# Brand Guided Audience Finder

Redesign the brand portal from a text-heavy chat into a guided, chip-based flow that collects brand info upfront, asks AI-driven multiple-choice questions, shows a thinking stepper, and lands on an action-oriented results dashboard.

## Problem

The current chat-based brand portal asks the right questions but requires brands to type long free-text answers. This creates friction — a brand head just wants to find their audience quickly. The experience needs to feel like a smart quiz, not a text conversation.

## Design: 4-Step Flow

### Step 1: Intake Card

A centered card on the portal page. Clean, minimal.

**Fields:**
- Brand name (text)
- Website URL (url)
- Instagram handle (text, prefixed with @)
- One-line description — "What do you sell?" (text)

**Button:** "Find My Audience"

On submit, store the intake data and kick off background enrichment (scrape website + IG for context). Transition to Step 2 immediately — don't block on enrichment.

**Component:** New `BrandIntakeCard.svelte`

### Step 2: Guided Questions (AI-Driven, Chip Answers)

The AI still drives question selection (same Claude Haiku match-agent logic), but the UI renders answers as clickable chips instead of expecting typed responses.

**UI behavior:**
- One question at a time, centered on screen
- AI returns 3-5 clickable chip options per question
- Small "Type your own answer" text input below the chips for edge cases
- Answered questions slide up smoothly, next question fades in
- Subtle progress indicator (dots or thin bar) showing ~how far along
- Expect ~4-6 questions total: goal, buyer type, geography, budget, success metric, content style

**Backend change:**
- Modify the match-agent system prompt to return structured responses: each question must include a `choices` array (label + value pairs) alongside the question text
- The SSE stream adds a new event type `choices` carrying the options array
- Frontend parses `choices` events and renders chips instead of plain text bubbles

**Component:** Rewrite `MatchAgentChat.svelte` into `GuidedQuestions.svelte`

### Step 3: Thinking Stepper

Once the AI has enough info and calls `extract_brand_brief`, transition from the question flow to a full-width stepper animation.

**Steps displayed:**
1. "Understanding your brand..." — fires when `extract_brand_brief` tool is called
2. "Analyzing creator signals..." — fires when `run_creator_match` starts
3. "Matching to your audience..." — fires when scoring completes
4. "Building your campaign plan..." — fires when results are ready

Each step shows a subtle animation while active, then a checkmark when done. Real progress tied to actual SSE events (`status` events from the stream).

**Component:** New `ThinkingStepper.svelte`

### Step 4: Results Dashboard (Action-First)

**Top row — 4 summary cards:**
| Card | Data Source |
|------|------------|
| Total Reach | Sum of matched creators' follower counts |
| Matched Creators | Count of matched creators |
| Estimated Cost | `reward_inr * matched_count` from rates |
| Recommended Strategy | AI-generated one-liner from brief context |

**Middle — Selectable creator grid:**
- Cards showing: creator initials/photo, name, match score (as percentage), 2-3 key tags, follower count, city
- Checkbox on each card for selection
- Cards sorted by match score descending
- Optional filters: by score, cost, reach

**Bottom — Sticky action bar:**
- Left: "X selected" count + total estimated cost
- Right: "Start Campaign" primary button + "Download Brief" secondary
- Bar appears once at least 1 creator is selected

**Component:** Rewrite results section of `+page.svelte` into `ResultsDashboard.svelte`

## File Changes

### New Components
- `src/lib/components/brands/BrandIntakeCard.svelte` — Step 1 intake form
- `src/lib/components/brands/GuidedQuestions.svelte` — Step 2 chip-based Q&A (replaces MatchAgentChat)
- `src/lib/components/brands/ThinkingStepper.svelte` — Step 3 progress stepper
- `src/lib/components/brands/ResultsDashboard.svelte` — Step 4 action-first results

### Modified Files
- `src/routes/brands/portal/+page.svelte` — orchestrates the 4-step flow, manages step transitions
- `src/lib/server/marketplace/brandMatchAgent.ts` — update system prompt to return structured choices with each question; add `choices` SSE event type
- `src/routes/api/brand/match-agent/+server.ts` — parse and forward `choices` from AI response

### Unchanged
- Creator scoring logic (`creatorScoring.ts`)
- Graph strength calculation (`graphStrength.ts`)
- Audience matching (`audienceMatch.ts`)
- Database schema
- Auth/session handling

## Out of Scope
- Brand account creation or login changes
- Campaign execution after "Start Campaign" click
- Creator scoring algorithm changes
- New database tables
- Enrichment API for website/IG scraping (stub it, implement later)
