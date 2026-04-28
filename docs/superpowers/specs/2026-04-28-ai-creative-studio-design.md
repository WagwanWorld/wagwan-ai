# AI Creative Studio — Design Spec (v2, hardened)

**Date:** 2026-04-28
**Status:** Design — ready for engineering review
**Scope:** Module 2 of Content Automation. Builds on Auto-Post Scheduler (Module 1, live).

> **Legend**
> 🟡 **RECOMMENDED** — open decision; default proposed, override before build.
> 🔴 **BLOCKER** — must be resolved before this can ship.
> ⚙️ **CONTRACT** — interface with another module; freeze before parallel work.

---

## 1. Overview

The AI Creative Studio lets brands generate ready-to-post Instagram creatives from either their own copy or a brief. Claude acts as creative director — analyzing brand identity, past posts, and audience — then orchestrates a render pipeline that produces on-brand visuals with reliably-rendered text. The system learns from every approval, rejection, and revision via a persistent creative context.

**Two modes:**
1. **"I have the copy"** — user pastes copy → Claude generates the visual.
2. **"Start from scratch"** — user writes brief → Claude generates copy ideas → user picks → Claude generates visual.

**Formats:** Static (1:1, 4:5), Story (9:16), Carousel (3–6 slides). No video.

**Revisions:** Unlimited regenerations, but only **2 "committed" revisions** count toward the version history. Users can revert to any prior version. (See §7.)

**Learning:** Every interaction logs to a persistent creative context with bounded growth (rolling window + summarization, see §5).

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                          USER (Brand)                                │
└────────────────────────────────┬─────────────────────────────────────┘
                                 │ REST
┌────────────────────────────────▼─────────────────────────────────────┐
│                      Orchestrator Service                            │
│  • Reads creative_context (DB)                                       │
│  • Calls Claude (creative direction)                                 │
│  • Calls Image Model (composition)                                   │
│  • Composites brand layer (logo, exact text)                         │
│  • Runs QC pass                                                      │
│  • Writes to GCS, logs cost, updates taste                           │
└──┬────────┬──────────┬──────────┬──────────┬─────────────────────────┘
   │        │          │          │          │
┌──▼──┐ ┌──▼──────┐ ┌─▼────────┐ ┌▼────────┐ ┌▼────────┐
│Claude│ │  Image  │ │Composite │ │   QC    │ │  GCS    │
│(Son- │ │  Model  │ │  Layer   │ │ (Haiku) │ │ Storage │
│ net) │ │(NanoBan)│ │(HTML→PNG)│ │         │ │         │
└──────┘ └─────────┘ └──────────┘ └─────────┘ └─────────┘
                          │
                          ▼
                ┌──────────────────┐
                │ Brand Asset Store│
                │ (logo SVG, fonts)│
                └──────────────────┘
```

**Why this shape:** the original spec had a single "Claude generates the image" step. This architecture splits the work into roles each system is good at: Claude directs, an image model composes, a deterministic layer guarantees brand correctness, and a QC pass validates the output.

### Render pipeline (per image)

| Step | System | Input | Output |
|------|--------|-------|--------|
| 1. Direction | Claude Sonnet | creative_context + copy + 5 reference thumbnails | Creative brief JSON (concept, layout spec, color choices, type spec, copy positioning, asset slots) |
| 2. Composition | Image model (🟡 Nano Banana / Gemini 2.5 Flash Image) | Layout spec + style reference image | Background image **+ AI-rendered headline text** |
| 3. Brand overlay | Deterministic compositor (HTML→PNG via Satori or Puppeteer) | Composition output + brand asset store (logo SVG, exact typography, legal text) | Final PNG with **real logo, exact brand fonts** for any text marked `lock: true` |
| 4. QC | Claude Haiku (vision) | Final PNG | Pass / fail flags: `text_garbled`, `logo_distorted`, `off_palette`, `safe_zone_violated` |
| 5. Persist | Orchestrator | Final PNG + metadata | GCS URL, generation record, cost log |

**If QC fails:** auto-retry once with stricter constraints (lower temperature, more explicit text positioning). If second attempt fails, surface to user with "Regenerate" option, no charge for the failed attempt.

### Why Nano Banana (Gemini 2.5 Flash Image) as the recommended image model

Best in class for in-image text rendering as of early 2026, supports reference-image conditioning (critical for carousel consistency — see §8), and pricing is competitive. **🟡 Confirm current pricing and rate limits before locking.** Fallback: Ideogram v3.

### What gets AI-rendered vs composited

| Element | AI-rendered (Nano Banana) | Composited (deterministic) |
|---------|--------------------------|---------------------------|
| Background, photography, illustration | ✅ | |
| Decorative typography, hero headlines | ✅ (when concept calls for it) | |
| Body copy, captions on image | | ✅ |
| Logo | | ✅ (always — never AI-generated) |
| Legal/compliance text (prices, disclaimers) | | ✅ |
| URLs, handles, hashtags | | ✅ |
| Anything user marks `lock: true` | | ✅ |

This split is the difference between a tool brands trust and one they don't.

---

## 3. Creative Director Persona (Claude Sonnet system prompt)

Stored as a versioned constant in code (not DB).

> You are a senior creative partner for this brand — operating simultaneously as Brand Strategist, Creative Director, Art Director & Graphic Designer, and Social Copywriter.
>
> You are not a yes-machine. If a request would dilute the brand or produce a weak post, say so and propose a stronger alternative.
>
> **Brand guidelines** are the constitution. **Past posts** are the case law. When they disagree, past posts reveal what the brand has evolved into — flag the tension and ask which direction to follow.
>
> Before producing output, silently analyze: visual system (dominant colors with hex, type pairings, grid behavior, image treatment, white-space density, recurring motifs), voice & tone, composition patterns, audience signal.
>
> Every design choice must be traceable to a guideline or past post. No filler, no generic marketing-speak, no emoji-stuffed captions unless the brand does that.
>
> Your output is a structured brief that an image model and a deterministic compositor will execute. Specify: layout grid, exact hex colors, typography stack (with fallbacks), copy with positioning, asset slots (logo, lock-text), and what should be AI-generated vs composited. If you cannot specify a choice with confidence, mark it `auto` rather than guessing.

### Output schema (JSON, validated before downstream calls)

```typescript
{
  concept: string,              // 2-3 sentences, shown to user
  format: "static_1x1" | "static_4x5" | "story_9x16" | "carousel",
  slideCount?: number,          // carousel only
  designDirection: {
    layout: string,             // human-readable, shown to user
    grid: GridSpec,             // machine-readable for compositor
    palette: { hex: string, role: string }[],
    typography: TypeSpec[],
    imagery: string,            // prompt for image model
    motifs: string[]
  },
  copy: {
    onImage: TextBlock[],       // each block has {text, position, lock}
    caption: string,
    cta: string,
    hashtags: string[]
  },
  assets: {
    logo: { position: GridPosition, size: string },
    locked: TextBlock[]         // text that MUST be composited, not AI-rendered
  },
  whyThisWorks: string[],       // 2-3 bullets, shown to user
  imageModelPrompt: string      // synthesized prompt for Nano Banana
}
```

The orchestrator validates this schema. Schema failures trigger a retry with the validation error appended to the prompt.

---

## 4. Brand Creative Context (storage redesigned)

### 🔴 BLOCKER fix: `taste_log` cannot live in JSONB

The original spec put `taste_log` as an unbounded array in `creative_context` JSONB. After ~500 entries the row gets slow on every generation. **Split it.**

### Schema

```sql
-- Updated: brand_accounts
ALTER TABLE brand_accounts
  ADD COLUMN IF NOT EXISTS creative_context JSONB DEFAULT '{}';
-- Holds: visual_identity, voice_profile, learned_preferences, last_refreshed
-- Bounded size, refreshed daily.

-- New: separate table for high-volume taste log
CREATE TABLE creative_taste_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT REFERENCES brand_accounts(ig_user_id),
  generation_id UUID,
  type TEXT,                    -- full_generation | revision | approval | rejection
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_taste_log_brand_recent ON creative_taste_log(brand_account_id, created_at DESC);

-- New: cost ledger (also separate)
CREATE TABLE creative_cost_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT REFERENCES brand_accounts(ig_user_id),
  generation_id UUID,
  call_type TEXT,               -- copy_generation | direction | image_generation | qc | revision
  model_used TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  image_count INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `creative_context` (bounded JSONB)

```json
{
  "visual_identity": {
    "dominant_colors": [{"hex": "#FF5A1F", "role": "primary"}, {"hex": "#0A0A0A", "role": "ink"}],
    "type_style": "bold sans-serif headlines (Söhne Breit), light body (Inter)",
    "composition_patterns": "logo bottom-right, headline top-left on 12-col grid",
    "image_treatment": "clean flat, no grain, high contrast",
    "whitespace_density": "moderate (40-50% negative space)",
    "recurring_motifs": ["geometric shapes", "circular crops"]
  },
  "voice_profile": {
    "sentence_length": "short, punchy (avg 8-12 words)",
    "formality": "casual-professional",
    "hooks_reused": ["Stop doing X", "Here's what nobody tells you"],
    "words_avoided": ["synergy", "leverage", "game-changer"]
  },
  "learned_preferences": {
    "always_overrides_to": null,
    "revision_patterns_summary": "Prefers less text, warmer tones, larger headlines (summarized from last 90d)",
    "preferred_formats": {"static_1x1": 12, "carousel": 8, "story": 3},
    "approval_rate": 0.74
  },
  "last_refreshed": "2026-04-28T06:00:00Z",
  "context_version": 3
}
```

### Lifecycle

1. **First use:** Build `creative_context` from `brand_identity`, `brand_voice`, `brandKit`, last 10 fingerprints. Summarize via Haiku.
2. **Every generation:** One read of `creative_context` + last 5 thumbnails (URLs, fetched lazily by image model).
3. **Every approval/rejection/revision:** Append to `creative_taste_log`, **don't** mutate `creative_context`.
4. **Daily refresh cron:** Reads last 50 taste log entries, summarizes patterns into `learned_preferences.revision_patterns_summary`, updates `creative_context`. Bumps `context_version`.

This bounds the context Claude sees on every call (no more growing JSON), while keeping the full audit trail queryable.

---

## 5. Mode 1: "I Have the Copy"

### Flow

1. User pastes copy → optionally selects format (default: AI recommends).
2. Optionally marks specific phrases as `lock: true` (must be rendered exactly — see §2).
3. `POST /api/brand/creative-studio/generate-visual`
4. Orchestrator: read context → Claude direction → image model → composite → QC → return.
5. User sees review screen (concept, design direction, image, caption, why-it-works).

### Lock-text UX

Inline interaction: user highlights text in their pasted copy, clicks "Lock exact wording". Locked phrases are tagged in the request and rendered via the composite layer (real fonts, pixel-perfect). Use case: prices, dates, product names, legal phrases.

---

## 6. Mode 2: "Start from Scratch"

### Flow

1. User clicks "Start from scratch" on the Creative Studio landing.
2. User writes a brief (free-text, e.g., "launch post for our new service, target CFOs").
3. `POST /api/brand/creative-studio/generate-copy`
4. Claude receives: brief + `creative_context` + last 5 thumbnails.
5. Claude returns 3 copy ideas, each with:
   - Copy text (on-image and caption)
   - Suggested format (static / story / carousel)
   - One-line concept rationale
6. User reviews the 3 options:
   - Pick one → proceeds to visual generation (same as Mode 1 step 3-5)
   - "Generate more" → Claude generates 3 more options (appended, not replacing)
   - Edit any option → inline edit before proceeding
7. Visual generation proceeds as Mode 1.

### Copy Generation Model

Uses `claude-haiku-4-5-20251001` — fast and cheap for text-only generation.

---

## 7. Revision System (UX trap fixed)

### Original spec problem

"2 rounds, then final" — but if revision 2 is worse than the original, user has no escape.

### 🟡 RECOMMENDED: Versions, not rounds

- **Unlimited regenerations** within a generation session.
- Each regeneration creates a new **version** (V1, V2, V3…).
- User can pin **up to 2 versions as "committed revisions"** plus the original — these go into the audit trail and count toward learning.
- User can revert to any version at any time.
- Approve action freezes whichever version is currently selected.

This keeps the "2 rounds" cost discipline (only 3 versions max are persisted to the taste log) while removing the trap.

### Revision panel

Side-by-side with version dropdown (not just left/right). Free-text field + toggle pills:

| Toggle | Options |
|--------|---------|
| Layout | Centered / Left-aligned / Asymmetric |
| Mood | Warmer / Cooler / Bolder / Softer |
| Text size | Larger / Smaller |
| Density | More whitespace / More content |

Toggles + free-text → revision prompt → orchestrator → new version.

### Cost guard

🟡 Soft cap: 6 regenerations per generation session. After 6, show a warning but allow continue. Hard cap: 12 (prevents runaway cost from a stuck user).

---

## 8. Carousel Generation (consistency mechanism specified)

### 🔴 BLOCKER fix: consistency mechanism

### Mechanism

1. **Slide 1 generated first.** This is the *style anchor*. Claude produces a full design direction; image model produces the slide.
2. **User approves slide 1.** This locks the visual system for the carousel: palette, type, layout grid, motifs. Stored as a `style_lock` object.
3. **Slides 2–N generated with slide 1 as reference image.** Nano Banana supports image-conditioned generation — pass slide 1 as a style reference. Layout grid, palette, type are passed deterministically via the composite layer.
4. **Per-slide copy** generated by Claude in a single batched call (one prompt: "given this carousel narrative, write on-image copy for slides 2–N"), not N separate calls.
5. **Final slide (CTA)** uses a known CTA layout from the brand's past posts when one exists; falls back to standard CTA template.

### Per-slide revision

Allowed, but reverting slide 2 to V1 doesn't affect other slides. Revision count is per-slide.

### Specs

- 3–6 slides (Claude proposes; user can override)
- Slide 1: hook, max 8 words on-image
- Middle slides: value/content
- Final slide: CTA, must include brand handle + URL (composited, locked)

---

## 9. Failure Modes

| Failure | Detection | Response |
|---------|-----------|----------|
| Image model returns garbled text | QC pass (Haiku vision check) | Auto-retry with stricter prompt; if 2nd fails, surface to user, no charge |
| Image model timeout (>30s) | Orchestrator timeout | Return error with retry button; cost not logged |
| Image model rate limit | API error code | Fallback to Ideogram v3; log degraded mode |
| Logo distorted (if AI-generated by mistake) | QC pass | Should never happen — composite layer always overlays real logo. Alarm if detected |
| Off-palette colors | QC pass (sample 10 pixels, compare to brand hex) | Soft warn user, don't block |
| Safe-zone violation (text in IG crop zone) | Compositor checks against IG safe zones | Auto-reposition; if not possible, regenerate |
| Brand-unsafe content in copy (competitor name, banned word) | Pre-flight check before Claude call | Block with clear message |
| NSFW / unsafe brief | Claude refusal | Standard refusal flow, no spend |
| Module 1 (scheduler) down on approve | API error | Save creative to GCS anyway, queue for scheduler retry, surface "saved, will schedule when scheduler is back" |
| Generation cost exceeds brand monthly cap | Pre-flight check | Block with "you've hit your AI generation cap this month" |

### QC pass details

After composite, run Haiku with vision on the final PNG with prompt:

> Check this Instagram creative for:
> 1. Is all text legible and correctly spelled?
> 2. Is the logo present, undistorted, and positioned in [expected zone]?
> 3. Are the dominant colors approximately [brand hex list]?
> 4. Is any text inside the Instagram safe zone violation area (top 250px / bottom 340px for 1:1)?
> Return JSON: { textLegible, logoOk, paletteOk, safeZoneOk, issues: [] }

Cost: ~$0.001 per QC pass. Worth it.

---

## 10. Cost Model (recalculated)

### Revised per-generation cost (single static, no revision)

| Step | Model | Tokens / Calls | Cost (USD) |
|------|-------|----------------|------------|
| Direction | Sonnet | 8K in (incl. 5 thumbnails @ ~1.5K each), 1.5K out | ~$0.046 |
| Image generation | Nano Banana | 1 image @ 1080² | ~$0.04 (🟡 confirm) |
| Composite | Self-hosted (Satori) | — | ~$0.001 (compute) |
| QC | Haiku vision | 2K in (1 image), 0.3K out | ~$0.003 |
| **Total** | | | **~$0.09** |

### With revision (1 round)

~$0.09 × 1.6 ≈ **$0.14**

### Carousel (5 slides, no revision)

~$0.09 (slide 1) + 4 × $0.06 (slides 2–5, lighter direction) ≈ **$0.33**

### 🟡 RECOMMENDED: Per-brand monthly cap

Default $50/mo per brand → ~350 static generations or ~150 carousels. Configurable per plan tier.

### Cost Ledger

Every API call writes to `creative_cost_log`. Brand dashboard surfaces:
- Today's spend
- This month's spend vs cap
- Cost per approved post (efficiency metric)
- Per-call breakdown for debugging

---

## 11. Brand Asset Store

### 🔴 BLOCKER: needed for the composite layer to work

```sql
CREATE TABLE brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT REFERENCES brand_accounts(ig_user_id),
  type TEXT,        -- logo_primary | logo_mark | font_file | watermark
  variant TEXT,     -- light | dark | mono
  format TEXT,      -- svg | woff2 | png
  url TEXT,         -- GCS url
  metadata JSONB,   -- safe-area, min-size, license info
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Population

- On brand onboarding, import existing brand kit (already in `brandKit` per Module 1).
- Logos must be SVG (vector) when available; PNG with transparency as fallback.
- Fonts: store WOFF2 in GCS, load into compositor. **License check required** — if brand provides a commercial-use font without license proof, fall back to system-safe equivalent and warn.
- 🟡 Default behavior when no logo provided: composite layer uses brand text-mark in primary color, generates warning to upload logo.

---

## 12. API Endpoints (revised contracts)

### `POST /api/brand/creative-studio/generate-copy`

Generate 3 copy ideas from a brief (Mode 2).

**Request:**
```json
{
  "brief": "launch post for our new reconciliation service, target CFOs",
  "count": 3,
  "constraints": { "format": "carousel", "maxSlides": 5 }
}
```

**Response:**
```json
{
  "ok": true,
  "ideas": [
    {
      "id": "idea_xxx",
      "copy": "Your finance team is drowning in spreadsheets...",
      "caption": "The full Instagram caption...",
      "format": "carousel",
      "slideCount": 5,
      "rationale": "Hook-first narrative that mirrors the brand's problem-solution pattern"
    }
  ],
  "cost": { "input_tokens": 2400, "output_tokens": 800, "cost_usd": 0.003 },
  "generationSessionId": "gs_xxx"
}
```

**Model:** `claude-haiku-4-5-20251001`

### `POST /api/brand/creative-studio/generate-visual`

**Request:**
```json
{
  "generationSessionId": "gs_xxx",
  "copy": "The on-image text...",
  "caption": "The Instagram caption...",
  "format": "static_1x1",
  "lockedPhrases": ["$49/mo", "Available May 1"],
  "brief": "Optional original brief"
}
```

**Response:**
```json
{
  "ok": true,
  "generationId": "gen_xxx",
  "version": 1,
  "concept": "Why this works...",
  "designDirection": "Layout, colors, type specifics...",
  "whyThisWorks": ["Bullet 1", "Bullet 2"],
  "imageUrl": "https://storage.googleapis.com/.../v1.png",
  "format": "static_1x1",
  "dimensions": "1080x1080",
  "qcReport": { "textLegible": true, "logoOk": true, "paletteOk": true, "safeZoneOk": true },
  "cost": { "total_usd": 0.089, "breakdown": [] }
}
```

### `POST /api/brand/creative-studio/revise`

**Request:**
```json
{
  "generationId": "gen_xxx",
  "fromVersion": 1,
  "feedback": "Make the headline bigger, warmer tones",
  "toggles": { "mood": "warmer", "text_size": "larger" }
}
```

**Response:** same shape as `generate-visual`, with `version: 2`.

### `POST /api/brand/creative-studio/revert`

```json
{ "generationId": "gen_xxx", "toVersion": 1 }
```

Sets the active version. No cost.

### `POST /api/brand/creative-studio/approve`

⚙️ **CONTRACT with Module 1**

```json
{
  "generationId": "gen_xxx",
  "version": 2,
  "sendToScheduler": true,
  "scheduleHint": { "preferredDate": "2026-05-02", "preferredSlot": "morning" }
}
```

**Response:**
```json
{
  "ok": true,
  "gcsUrl": "https://storage.googleapis.com/.../final.png",
  "scheduledPostId": "sp_xxx",
  "scheduledFor": "2026-05-02T09:30:00Z",
  "schedulerStatus": "queued"
}
```

### `GET /api/brand/creative-studio/history`

Lists past generations with thumbnails, prompt, cost, approval status, version count. Pagination: cursor-based on `created_at DESC`.

### `POST /api/brand/creative-studio/carousel/generate-rest`

After slide 1 approval, generates slides 2–N with style lock.

```json
{
  "generationId": "gen_xxx",
  "slide1Version": 2,
  "slideCount": 5,
  "narrative": "optional override"
}
```

---

## 13. UI Components

| Component | Responsibility |
|-----------|---------------|
| `CreativeStudio.svelte` | Container, state machine (idle → mode → generate → review → revise → approve) |
| `CreativeStudioLanding.svelte` | Two mode cards + recent generations strip |
| `CopyIdeaPicker.svelte` | 3+ copy ideas with pick/edit/generate-more, lock-phrase highlighting |
| `VisualReview.svelte` | Image, concept, design direction, why-it-works, version selector |
| `RevisionPanel.svelte` | Side-by-side, version dropdown, free-text + toggles, version pin (max 2) |
| `CarouselBuilder.svelte` | Slide-by-slide review, style-lock indicator on slide 1, per-slide revision |
| `BrandAssetUploader.svelte` | First-run modal if no logo on file (blocks generation otherwise) |
| `CostMeter.svelte` | Persistent footer pill: "$X.XX of $50 this month" |
| `QCBadge.svelte` | Small badge on review screen showing QC results, expandable on click |

### Integration

"AI Creative Studio" card on Content Automation home → `CreativeStudio.svelte`. On approve, contract in §12 fires; user lands on Module 1 schedule confirmation.

---

## 14. Database Migrations

```sql
-- 001_creative_context.sql
ALTER TABLE brand_accounts
  ADD COLUMN IF NOT EXISTS creative_context JSONB DEFAULT '{}';

-- 002_taste_log.sql
CREATE TABLE creative_taste_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT REFERENCES brand_accounts(ig_user_id),
  generation_id UUID,
  type TEXT,
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_taste_log_brand_recent ON creative_taste_log(brand_account_id, created_at DESC);

-- 003_cost_log.sql
CREATE TABLE creative_cost_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT REFERENCES brand_accounts(ig_user_id),
  generation_id UUID,
  call_type TEXT,
  model_used TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  image_count INTEGER DEFAULT 0,
  cost_usd NUMERIC(10,5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_cost_log_brand_month ON creative_cost_log(brand_account_id, date_trunc('month', created_at));

-- 004_brand_assets.sql
CREATE TABLE brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT REFERENCES brand_accounts(ig_user_id),
  type TEXT,
  variant TEXT,
  format TEXT,
  url TEXT,
  metadata JSONB,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 005_generations.sql
CREATE TABLE creative_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_account_id TEXT REFERENCES brand_accounts(ig_user_id),
  generation_session_id UUID,
  mode TEXT,              -- copy_first | from_scratch
  format TEXT,
  brief TEXT,
  status TEXT,            -- in_progress | approved | abandoned
  active_version INTEGER,
  approved_version INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE TABLE creative_generation_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id UUID REFERENCES creative_generations(id),
  version INTEGER,
  image_gcs_url TEXT,
  thumbnail_url TEXT,
  payload JSONB,          -- full direction, copy, qc report
  cost_usd NUMERIC(10,5),
  is_pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(generation_id, version)
);
```

---

## 15. Observability

### Metrics

- `creative_studio.generation.started{mode, format}`
- `creative_studio.generation.completed{mode, format, success}`
- `creative_studio.qc.failed{reason}`
- `creative_studio.image_model.latency_ms` (histogram)
- `creative_studio.cost_per_generation_usd` (histogram)
- `creative_studio.approval_rate` (rolling 7d, per brand)
- `creative_studio.revisions_per_approval` (per brand)

### Alerting

- QC failure rate >10% over 1h → page on-call (image model degradation)
- Image model p95 latency >20s → warn
- Brand monthly cost >90% of cap → notify brand
- Cost log write failure → page (data integrity)

### Logs

Structured per generation: brand_id, generation_id, mode, format, every API call's tokens/cost, every QC result, every revision, every approval. Required for cost reconciliation and learning loop debugging.

---

## 16. Security & Compliance

- **Brand asset access:** assets are tenant-scoped; no cross-brand leakage. Validated at every read.
- **Content moderation:** outgoing prompts to image model are pre-filtered for prohibited content (Claude pre-flight). Returned images get an additional unsafe-content check via safety classifier.
- **Logo provenance:** every composite logs which `brand_assets.id` was used. If a brand disputes a generated post, we can trace the logo source.
- **PII in copy:** if user pastes customer testimonials with names, surface a warning ("Detected what may be a person's name. Confirm you have permission to use it."). Don't block.
- **Generated content ownership:** clarify in ToS that generated creatives are owned by the brand. Recommended: add a manifest file alongside each GCS PNG with model versions used (for IP audits).

---

## 17. Out of Scope

- Video generation (Reels, Stories with motion)
- Multi-platform output (TikTok, LinkedIn, X)
- Template library / saved templates
- Real-time collaboration
- A/B testing of creatives
- Credit/billing UI (data tracked, no UI)

---

## 18. Open Questions / Decisions Needed Before Build

1. 🟡 Lock in image model: Nano Banana primary, Ideogram v3 fallback? Need pricing confirmation and rate-limit headroom.
2. 🟡 Compositor implementation: Satori (lightweight, JSX-based) vs Puppeteer (heavier, full HTML/CSS)? Recommendation: Satori for speed, fall back to Puppeteer only if needed.
3. 🟡 Monthly cost cap default ($50)? Per plan tier?
4. 🟡 What happens when scheduler is down on approve — save & retry (current proposal) or block approve until scheduler is back?
5. 🟡 Carousel: should style-lock from slide 1 be user-overridable on later slides, or strictly enforced?
6. 🔴 Brand asset onboarding: blocking flow on first studio use (must upload logo) vs. soft (warn but allow)?
7. ⚙️ Module 1 contract: confirm the `approve` payload matches Module 1's expected ingestion schema.
8. 🟡 QC threshold: how strict? E.g., palette match — exact hex or within ΔE of 5?
9. 🟡 Font licensing: how do we verify a font they upload? Manual review on first upload, or self-attest with audit trail?

---

## 19. Phased Rollout

**Phase 1 (MVP, 4 weeks):** Mode 1 only, static 1:1, Nano Banana, basic QC, no carousel. Single revision round (committed). Internal beta with 3 brands.

**Phase 2 (+3 weeks):** Mode 2, all static formats, story format, version system (unlimited regen, 2 pinned).

**Phase 3 (+4 weeks):** Carousel with style-lock. Daily learning refresh job.

**Phase 4 (+2 weeks):** Cost dashboard, brand monthly caps, alerting.

Total: ~13 weeks to full spec from kickoff.
