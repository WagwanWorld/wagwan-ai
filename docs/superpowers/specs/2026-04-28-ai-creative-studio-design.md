# AI Creative Studio — Design Spec

**Date:** 2026-04-28  
**Status:** Design  
**Scope:** Module 2 of Content Automation — AI-powered visual creative generation. Builds on the Auto-Post Scheduler (Module 1) which is already live.

---

## Overview

The AI Creative Studio lets brands generate ready-to-post Instagram creatives from either their own copy or a brief. Claude acts as a creative director — analyzing the brand's visual identity, past posts, and audience before generating on-brand visuals with baked-in text. The system learns from every approval and rejection, getting better over time.

**Two modes:**
1. **"I have the copy"** — user pastes copy, Claude generates the visual
2. **"Start from scratch"** — user writes a brief, Claude generates copy ideas, user picks one, Claude generates the visual

**Formats:** Static image (1:1, 4:5), Story (9:16), Carousel (3-6 slides). No video.

**Revisions:** 2 rounds per creative, with free-text feedback + quick toggles.

**Learning:** Every generation, approval, rejection, and revision is logged to a persistent creative context that grows over time, making future generations more aligned with the brand's taste.

---

## Creative Director Persona

Claude operates with this system prompt for all creative generation:

> You are a senior creative partner for this brand — operating simultaneously as Brand Strategist, Creative Director, Art Director & Graphic Designer, and Social Copywriter.
>
> You are not a yes-machine. If a request would dilute the brand or produce a weak post, say so and propose a stronger alternative.
>
> **Brand guidelines** are the constitution. **Past posts** are the case law. When they disagree, past posts reveal what the brand has evolved into — flag the tension and ask which direction to follow.
>
> Before producing output, silently analyze: visual system (dominant colors with hex, type pairings, grid behavior, image treatment, white-space density, recurring motifs), voice & tone, composition patterns, audience signal.
>
> Every design choice must be traceable to a guideline or past post. No filler, no generic marketing-speak, no emoji-stuffed captions unless the brand does that.

The full persona prompt (including output format requirements) is stored as a constant in the codebase — not in the DB — so it's versioned with the code.

---

## Brand Creative Context (Persistent, Learning)

### Storage

New JSONB column `creative_context` on `brand_accounts` table. Built once on first studio use, grows with every interaction.

### Structure

```json
{
  "visual_identity": {
    "dominant_colors": ["#hex1", "#hex2"],
    "type_style": "bold sans-serif headlines, light body",
    "composition_patterns": "logo bottom-right, headline top-left",
    "image_treatment": "clean flat, minimal grain",
    "whitespace_density": "moderate",
    "recurring_motifs": ["geometric shapes", "brand mascot"]
  },
  "voice_profile": {
    "sentence_length": "short, punchy",
    "formality": "casual-professional",
    "hooks_reused": ["Stop doing X", "Here's what nobody tells you"],
    "words_avoided": ["synergy", "leverage"]
  },
  "taste_log": [
    {
      "timestamp": "2026-04-28T18:00:00Z",
      "type": "full_generation",
      "prompt": "launch post for new service",
      "chosen_copy": "The copy they picked",
      "rejected_copies": ["option 2", "option 3"],
      "format_suggested": "carousel",
      "format_final": "carousel",
      "revisions": [
        { "round": 1, "feedback": "make headline bigger", "toggles": { "text_size": "larger" } }
      ],
      "approved": true
    }
  ],
  "generation_costs": [
    {
      "timestamp": "2026-04-28T18:00:00Z",
      "type": "copy_generation",
      "model_used": "claude-haiku-4-5-20251001",
      "input_tokens": 2400,
      "output_tokens": 800,
      "cost_usd": 0.003
    },
    {
      "timestamp": "2026-04-28T18:01:00Z",
      "type": "image_generation",
      "model_used": "claude-sonnet-4-20250514",
      "input_tokens": 5000,
      "output_tokens": 1200,
      "cost_usd": 0.02
    }
  ],
  "learned_preferences": {
    "always_overrides_to": null,
    "revision_patterns": ["often asks for less text", "prefers warmer tones"],
    "preferred_formats": { "static_1x1": 12, "carousel": 8, "story": 3 }
  },
  "last_refreshed": "2026-04-28T06:00:00Z"
}
```

### Lifecycle

1. **First use:** System builds `creative_context` by analyzing brand kit, last 10 post fingerprints, audience data, and visual direction. Stored in DB.
2. **Every generation:** Context read from DB (one query). Last 5 post thumbnails fetched from `recentPosts` and sent to Claude as visual references.
3. **Every approval/rejection:** `taste_log` entry appended, `learned_preferences` updated.
4. **Daily refresh:** The existing brand intelligence cron merges new posts, updated brand kit, and fresh fingerprints into the context.

---

## Mode 1: "I Have the Copy"

### Flow

1. User clicks "I have the copy" on the Creative Studio landing
2. User pastes their copy text into a textarea
3. User optionally selects preferred format (or leaves it as "AI recommends")
4. System calls `/api/brand/creative-studio/generate-visual`
5. Claude receives:
   - The copy text
   - `creative_context` from DB
   - Last 5 post thumbnails as images
   - Creative director system prompt
6. Claude responds with:
   - **Concept** (2-3 sentences — why this works)
   - **Format & specs** (platform, dimensions)
   - **Design direction** (layout, colors, type, imagery — specific enough for Figma)
   - **The generated image** (ready-to-post, text baked in)
   - **Caption** (for the Instagram caption field, in brand voice)
   - **Why this works** (2-3 bullets connecting choices to brand references)
7. User sees the review screen

---

## Mode 2: "Start from Scratch"

### Flow

1. User clicks "Start from scratch" on the Creative Studio landing
2. User writes a brief (free-text, e.g., "launch post for our new reconciliation service, target CFOs")
3. System calls `/api/brand/creative-studio/generate-copy`
4. Claude receives: brief + `creative_context` + last 5 thumbnails
5. Claude returns 3 copy ideas, each with:
   - Copy text (the actual on-image and caption text)
   - Suggested format (static / story / carousel)
   - One-line concept rationale
6. User reviews the 3 options:
   - Pick one → proceeds to visual generation (same as Mode 1 step 4-7)
   - "Generate more" → Claude generates 3 more options (appended, not replacing)
   - Edit any option → inline edit before proceeding
7. Visual generation proceeds as Mode 1

### Copy Generation Model

Uses `claude-haiku-4-5-20251001` — fast and cheap for text-only generation. The brief + brand context is sufficient; no images needed at this stage.

---

## Revision System

### Rules
- **2 rounds maximum**, then it's final
- UI shows "Revision 1 of 2" / "Revision 2 of 2 — Final"
- After round 2 or user clicks "Approve", the creative is finalized

### Revision Interface

Side-by-side layout: previous version (left) vs current version (right, updates after revision).

**Free-text feedback field** — always visible, primary input. Examples:
- "Make the headline bigger and bolder"
- "Warmer tones, less corporate"
- "Move the logo to bottom-left"

**Quick toggles** — shortcuts for common adjustments:
| Toggle | Options |
|--------|---------|
| Layout | Centered / Left-aligned / Asymmetric |
| Mood | Warmer / Cooler / Bolder / Softer |
| Text size | Larger / Smaller |
| Density | More whitespace / More content |

Toggles and free-text are combined into the revision prompt sent to Claude.

### Revision API

`POST /api/brand/creative-studio/revise` — receives the original generation context + revision feedback + the previous image. Claude sees both the original brief and the specific feedback to produce a targeted revision.

---

## Carousel Generation

When Claude suggests a carousel (or user selects it):

1. **Slide 1 generated first** — the hook slide, most important
2. **User reviews slide 1** — approves the visual style/direction
3. **Remaining slides auto-generated** — Claude produces slides 2-6 maintaining visual consistency
4. Each slide gets its own on-image copy, auto-generated per slide
5. User can revise individual slides (counts toward the 2-revision limit per slide)
6. Full carousel review before sending to scheduler

Carousel specs:
- 3-6 slides (Claude decides based on content, user can override)
- Consistent visual identity across all slides (same palette, type, layout system)
- Slide 1: hook/attention grabber
- Middle slides: value/content
- Final slide: CTA

---

## Downloads

Every generated creative has a download button:
- **PNG** at full resolution for the selected format
- Format options: 1:1 (1080x1080), 4:5 (1080x1350), 9:16 (1080x1920)
- Downloads pull from GCS (images saved after generation)
- Carousel: download individual slides or all as a zip

---

## Cost Tracking

Every Claude API call logs usage to `creative_context.generation_costs`:

| Field | Type | Description |
|-------|------|-------------|
| `timestamp` | ISO string | When the call was made |
| `type` | enum | `copy_generation`, `image_generation`, `revision` |
| `model_used` | string | Model ID |
| `input_tokens` | number | Tokens sent |
| `output_tokens` | number | Tokens received |
| `cost_usd` | number | Estimated cost based on model pricing |

**Model pricing (used for estimates):**
- Haiku (copy): $0.80/M input, $4/M output
- Sonnet (images): $3/M input, $15/M output

**Visibility:**
- Activity feed shows cost per generation
- Brand dashboard can query total spend
- Lays groundwork for a credit system (not built now, but data is there)

---

## API Endpoints

### `POST /api/brand/creative-studio/generate-copy`

Generate copy ideas from a brief (Mode 2, step 1).

**Request:**
```json
{
  "brief": "launch post for our new reconciliation service, target CFOs",
  "count": 3
}
```

**Response:**
```json
{
  "ok": true,
  "ideas": [
    {
      "copy": "Your finance team is drowning in spreadsheets...",
      "caption": "The full Instagram caption...",
      "format": "carousel",
      "rationale": "Hook-first narrative that mirrors the brand's problem-solution pattern",
      "slideCount": 5
    }
  ],
  "cost": { "input_tokens": 2400, "output_tokens": 800, "cost_usd": 0.003 }
}
```

**Model:** `claude-haiku-4-5-20251001`

### `POST /api/brand/creative-studio/generate-visual`

Generate a ready-to-post visual from copy (both modes).

**Request:**
```json
{
  "copy": "The on-image text...",
  "caption": "The Instagram caption...",
  "format": "static_1x1",
  "brief": "Optional original brief for context"
}
```

**Response:**
```json
{
  "ok": true,
  "concept": "Why this works...",
  "designDirection": "Layout, colors, type specifics...",
  "whyThisWorks": ["Bullet 1", "Bullet 2"],
  "imageUrl": "https://storage.googleapis.com/wagwan-ai/...",
  "format": "static_1x1",
  "dimensions": "1080x1080",
  "generationId": "uuid",
  "cost": { "input_tokens": 5000, "output_tokens": 1200, "cost_usd": 0.02 }
}
```

**Model:** `claude-sonnet-4-20250514`

### `POST /api/brand/creative-studio/revise`

Revise a generated creative.

**Request:**
```json
{
  "generationId": "uuid",
  "feedback": "Make the headline bigger, warmer tones",
  "toggles": { "mood": "warmer", "text_size": "larger" },
  "round": 1
}
```

**Response:** Same shape as `generate-visual`.

### `POST /api/brand/creative-studio/approve`

Finalize a creative and update taste profile.

**Request:**
```json
{
  "generationId": "uuid",
  "sendToScheduler": true
}
```

**Response:**
```json
{
  "ok": true,
  "gcsUrl": "https://storage.googleapis.com/wagwan-ai/...",
  "sentToScheduler": true
}
```

### `GET /api/brand/creative-studio/history`

Get past generations for the brand.

**Response:** Array of past generations with thumbnails, prompts, costs, approval status.

---

## UI Components

### New Components

| Component | Responsibility |
|-----------|---------------|
| `CreativeStudio.svelte` | Container — manages mode selection, state machine |
| `CreativeStudioLanding.svelte` | Two mode cards: "I have the copy" / "Start from scratch" |
| `CopyIdeaPicker.svelte` | Shows 3+ copy ideas with pick/edit/generate-more |
| `VisualReview.svelte` | Shows generated creative with concept, design direction, why-this-works |
| `RevisionPanel.svelte` | Side-by-side comparison, free-text + toggles, round counter |
| `CarouselBuilder.svelte` | Slide-by-slide review for carousels |

### Integration

The "AI Creative Studio" card on the Content Automation home screen links to `CreativeStudio.svelte` (replacing the "Coming Soon" badge). On approval, the creative flows into Module 1's Drop & Schedule pipeline.

---

## Database Changes

### Modified: `brand_accounts`

```sql
ALTER TABLE brand_accounts
  ADD COLUMN IF NOT EXISTS creative_context JSONB DEFAULT '{}';
```

### New: Initial context builder

On first Creative Studio use, if `creative_context` is empty, the system builds it by:
1. Reading `brand_identity`, `brand_voice`, `brandKit` from existing data
2. Analyzing last 10 `brand_fingerprints` for style patterns
3. Summarizing via Claude (Haiku) into the `visual_identity` and `voice_profile` structure
4. Storing in `creative_context`

---

## Design Tokens

All UI follows the existing Brand OS glass design system:
- Same `bs-card`, `bs-label`, accent colors, Geist Mono labels
- Revision toggle pills use the same `cadence-pill` pattern from Module 1
- Side-by-side uses a `split` layout with a subtle divider
- Download button uses `prc-btn-ghost` pattern with a download icon

---

## Out of Scope

- Video generation (Reels, Stories with motion)
- Multi-platform output (TikTok, LinkedIn, X formats)
- Template library / saved templates
- Real-time collaboration
- Credit/billing system (data is tracked, system is not built)
- A/B testing of creatives
