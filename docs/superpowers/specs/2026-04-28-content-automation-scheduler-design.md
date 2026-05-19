lets # Content Automation — Auto-Post Scheduler

**Date:** 2026-04-28
**Status:** Design
**Scope:** Module 1 of Content Automation — the scheduling pipeline. Module 2 (AI Creative Generator) will be specced separately after this ships.

---

## Overview

Upgrade the brand portal's content workflow from manual upload-and-schedule to an AI-powered pipeline: **Upload → Generate → Review → Schedule → Post**. The user drops assets, AI generates captions/hashtags/mentions/alt-text using the brand kit, the user reviews and edits, then schedules to Instagram — individually or in bulk via a cadence rhythm.

This builds on top of existing functional infrastructure (Instagram OAuth, GCS upload, Meta Graph API publishing, `scheduled_posts` table, Vercel cron). The work is primarily: a new Content Automation tab with calendar view, bulk cadence mode, AI content generation, and backend hardening (cron frequency, token refresh, activity logging).

---

## Architecture

### New Tab in Portal Navigation

Content Automation becomes tab **03** in the top nav bar, sitting between "Find Creators" and "Profile & Insights". Accessed via `/brands/portal?tab=automation`. The existing Content Studio (tab 01) stays untouched as the analytics/dashboard view.

### Component Structure

```
ContentAutomation.svelte          ← Container, manages pipeline state
├── ContentPipelineStepper.svelte  ← Upload → Generate → Review → Schedule → Post
├── UploadZone.svelte              ← Reuse existing, add bulk mode toggle
├── BulkCadenceWizard.svelte       ← Multi-asset strip + rhythm config
├── PostReviewCard.svelte          ← AI-generated content review/edit per asset
├── ScheduleCalendar.svelte        ← Week/month calendar view
└── ActivityFeed.svelte            ← Right sidebar timeline
```

### Pipeline State Machine

```
idle → uploading → generating → reviewing → scheduling → scheduled
                                    ↑                        │
                                    └── edit ────────────────┘
```

The stepper highlights the current stage. Users can move backwards (e.g., from reviewing back to uploading more assets).

---

## UI Sections

### 1. Pipeline Stepper

Horizontal stepper below the nav: **Upload → Generate → Review → Schedule → Post**. Each step shows a numbered circle (Geist Mono, 10px) with status:

- **Active**: `#e8464a` accent border + fill
- **Completed**: `#4ade80` green border + checkmark
- **Inactive**: `rgba(255,255,255,0.1)` border, `#4A4A50` text

Connected by 32px lines at `rgba(255,255,255,0.08)`.

### 2. Upload Zone

Standard `bs-card` container with:

- Drag-and-drop zone: `1.5px dashed rgba(255,255,255,0.1)` border, `14px` radius
- Accepts: `.jpg`, `.png`, `.webp` (images, max 8MB), `.mp4`, `.mov` (videos, max 100MB)
- Multiple files for carousels or bulk mode
- Optional context input below: free-text hint for AI (e.g., "summer campaign shoot")
- Auto-detects post type per file: video → Reel, multiple images → Carousel, single image → Post
- On upload: files go to GCS via existing `/api/brand/upload` endpoint

### 3. AI Content Generation

After upload, the system calls `/api/brand/generate-post-content` for each asset. Processing state shows inside a `bs-card` with:

- Progress bar (`#e8464a` fill)
- Brand context chips showing what AI is using: brand voice, pillars, top hashtags, audience personas, post history, content pillars

**AI generates per asset:**

| Field     | Source                                                                                                                                                       | Editable                    |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------- |
| Caption   | Claude + brand voice + pillars + audience. Post-type-aware: Reels get hook-first copy, carousels get slide-by-slide, posts get CTA-focused. Max 2,200 chars. | Yes                         |
| Hashtags  | Mix of branded (green tags) + trending/topical (blue tags). Based on past performance + content pillars.                                                     | Yes, click to remove, + add |
| Mentions  | Collaborator/photographer handles from brand context + recent posts.                                                                                         | Yes, click to remove, + add |
| Location  | From brand profile or EXIF data if available.                                                                                                                | Yes, changeable             |
| Post type | Auto-detected, user can override via pill toggle (Post / Story / Reel / Carousel).                                                                           | Yes                         |
| Alt text  | Accessibility description from Claude visual analysis.                                                                                                       | Yes                         |

**Brand voice dropdown** (stored in brand kit, configurable): Bold / Playful / Premium / Minimal / Hype. Shapes all caption generation.

### 4. Post Review Card

Split layout inside the `bs-card`:

- **Left panel** (260px): media preview at 4:5 aspect ratio, post type pill selector below
- **Right panel**: all AI-generated fields as editable blocks, each with `bs-label` header and `ca-field-meta` showing character count or tag count

Pagination dots at top for multi-asset reviews (1 of 3, etc.).

Actions per card:

- **Schedule Post** — primary button, sends to `scheduled_posts`
- **Regenerate** — re-runs AI generation for this asset
- **Publish Now** — immediate publish via Meta Graph API

### 5. Schedule Calendar

#### Week View (Default)

- 7-column grid, one per day
- Toolbar: prev/next nav, week title (e.g., "Apr 28 – May 4, 2026"), Week/Month toggle, "+ New Post" button
- Each day column: Geist Mono header (e.g., "MON 28"), post cards stacked vertically
- Today's column gets a `2px #e8464a` accent line below the header
- Post cards show: thumbnail, time (Geist Mono), caption preview (truncated), status badge

Post card styling by status:

- **Scheduled**: `rgba(232,70,74,0.04)` bg, `rgba(232,70,74,0.12)` border, `#e8464a` time
- **Posted**: `rgba(127,200,169,0.04)` bg, `rgba(127,200,169,0.12)` border, `#7fc8a9` time + checkmark
- **Failed**: `rgba(248,113,113,0.04)` bg, `rgba(248,113,113,0.12)` border, `#f87171` time + "Retry" button

#### Month View

- 7-column grid, day headers at top
- Each cell: day number + colored dots indicating posts (scheduled = `#e8464a`, posted = `#7fc8a9`, failed = `#f87171`)
- Legend bar at bottom

#### Calendar Interactions

- **Click post card** → opens edit drawer (caption, time, retry, publish now)
- **Click empty day** → opens upload zone pre-filled with that date
- **Drag post to different day** → reschedules (PATCH `/api/brand/scheduled-posts`)
- **Click day in month view** → switches to week view centered on that week

### 6. Bulk Cadence Mode

Activated when multiple assets are uploaded. Shows:

**Asset strip**: horizontal scrollable row of asset cards. Each shows:

- Numbered order badge (top-left)
- Thumbnail with gradient background
- Filename + auto-detected type
- Hover: remove button (top-right)
- Draggable to reorder

**Cadence config**:

- **Frequency**: pill toggle — 1/day, 2/day, every 2 days, custom
- **Starting**: date picker
- **Time**: time picker
- **Timezone**: auto-detected from browser, editable

**Preview timeline**: horizontal strip showing each asset mapped to its posting slot with connectors. Shows day label, thumbnail, and time.

**AI note**: green-tinted info box explaining that captions will be generated uniquely per asset with post-type-aware copy patterns.

**Actions**:

- "Edit Individual Posts" → enters review card flow for each asset
- "Generate & Schedule All" → batch AI generation + batch schedule insert

### 7. Activity Feed

Right sidebar (260px width, collapses on tablet). Shows timestamped events:

- Upload, generation, schedule, publish, failure, retry, reschedule events
- Each event: timestamp (Geist Mono, `#4A4A50`), description (`#8A8A90`), in a `rgba(255,255,255,0.03)` card
- Polls every 30 seconds when tab is active

---

## Design Tokens

All components use the existing Brand OS glass design system:

| Token              | Value                                                                        |
| ------------------ | ---------------------------------------------------------------------------- |
| Card background    | `rgba(255,255,255,0.035)`                                                    |
| Card border        | `1px solid rgba(255,255,255,0.07)`                                           |
| Card border-radius | `14px`                                                                       |
| Card padding       | `18px 16px`                                                                  |
| Card hover border  | `rgba(255,255,255,0.12)`                                                     |
| Label font         | Geist Mono, 10px, 600 weight, uppercase, `0.1em` spacing                     |
| Label color        | `#4A4A50`                                                                    |
| Accent             | `#e8464a`                                                                    |
| Accent soft        | `rgba(232,70,74,0.15)`                                                       |
| Body text          | `#8A8A90` (secondary), `#ededef` (primary)                                   |
| Tertiary text      | `#4A4A50`                                                                    |
| Background         | `#0f0f11` with dot grid                                                      |
| Metric numbers     | Bodoni Moda, 24px, 700 weight                                                |
| Status: scheduled  | `#e8464a`                                                                    |
| Status: posted     | `#7fc8a9`                                                                    |
| Status: failed     | `#f87171`                                                                    |
| Button primary     | `rgba(232,70,74,0.15)` bg, `rgba(232,70,74,0.25)` border, `#e8464a` text     |
| Button ghost       | `rgba(255,255,255,0.04)` bg, `rgba(255,255,255,0.07)` border, `#8A8A90` text |

---

## API Design

### New Endpoints

#### `POST /api/brand/generate-post-content`

Generates AI content for uploaded assets.

**Request:**

```json
{
  "assets": [
    {
      "gcsUrl": "https://storage.googleapis.com/wagwan-ai/brands/.../file.jpg",
      "mediaType": "IMAGE",
      "context": "summer campaign shoot"
    }
  ],
  "brandIgId": "123456789"
}
```

**Response:**

```json
{
  "results": [
    {
      "gcsUrl": "...",
      "caption": "The summer drop just hit different...",
      "hashtags": ["#SummerDrop", "#Streetwear", "#BoldStyle"],
      "mentions": ["@brandhandle", "@photographer"],
      "location": "Mumbai, India",
      "altText": "A model wearing bold streetwear against an urban backdrop",
      "postType": "IMAGE",
      "brandVoice": "Bold"
    }
  ]
}
```

**Implementation:** Uses Claude (`claude-sonnet-4-6`) with a system prompt that includes:

- Brand voice setting
- Messaging pillars from `brandKit.messagingPillars`
- Audience personas from `audienceInsights.personas`
- Recent post performance data (top hashtags, best performing content types)
- Content pillar distribution

#### `POST /api/brand/schedule-bulk`

Batch schedules multiple posts with cadence.

**Request:**

```json
{
  "posts": [
    {
      "gcsUrl": "...",
      "mediaType": "IMAGE",
      "caption": "...",
      "hashtags": ["..."],
      "altText": "...",
      "mentions": ["@handle"]
    }
  ],
  "cadence": {
    "frequency": "daily",
    "startDate": "2026-04-28",
    "time": "09:00",
    "timezone": "Asia/Kolkata"
  },
  "brandIgId": "123456789"
}
```

**Response:**

```json
{
  "scheduled": [
    {
      "postId": "uuid",
      "scheduledAt": "2026-04-28T09:00:00+05:30",
      "gcsUrl": "...",
      "caption": "..."
    }
  ]
}
```

**Implementation:** Computes `scheduled_at` per post by iterating the cadence from `startDate` + `time` in the specified `timezone`. Batch inserts into `scheduled_posts` via Supabase.

#### `GET /api/brand/activity-feed`

Returns recent content activity events.

**Request:** `GET /api/brand/activity-feed?limit=50`

**Response:**

```json
{
  "events": [
    {
      "id": "uuid",
      "eventType": "published",
      "eventData": { "postId": "uuid", "caption": "Summer drop...", "igPermalink": "..." },
      "createdAt": "2026-04-28T09:00:00Z"
    }
  ]
}
```

### Modified Endpoints

#### `GET /api/cron/publish-scheduled`

**Changes:**

- Cron schedule: `*/15 * * * *` (every 15 minutes, up from daily)
- Remove 5-post limit — process all due posts
- Before publishing each post: check `token_expires_at` on the brand's account. If within 7 days of expiry, call `refreshBrandToken()` and update `brand_accounts`
- On publish/fail: insert event into `content_activity_log`

#### `POST /api/brand/publish-now`

**Changes:**

- Allow retrying `failed` status posts (currently only allows `scheduled`)
- On retry: reset `error_message` to null, set status to `publishing`, re-attempt Meta Graph API flow
- Insert activity event on outcome

#### `PATCH /api/brand/scheduled-posts`

**Changes:**

- No API changes needed — already supports `caption` and `scheduled_at` updates
- Calendar drag-to-reschedule calls this endpoint with the new `scheduled_at` value

---

## Database Changes

### New Table: `content_activity_log`

```sql
CREATE TABLE content_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_ig_id TEXT NOT NULL REFERENCES brand_accounts(ig_user_id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'uploaded', 'generated', 'scheduled', 'published', 'failed', 'retried', 'rescheduled'
  )),
  event_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cal_brand ON content_activity_log(brand_ig_id, created_at DESC);
```

### New Column: `brand_accounts.brand_voice`

```sql
ALTER TABLE brand_accounts
  ADD COLUMN brand_voice TEXT DEFAULT 'Bold'
  CHECK (brand_voice IN ('Bold', 'Playful', 'Premium', 'Minimal', 'Hype'));
```

---

## Responsive Behavior

- **Desktop (>1024px)**: full layout with activity feed sidebar
- **Tablet (768-1024px)**: activity feed collapses into a bottom drawer. Calendar shows 5 days in week view.
- **Mobile (<768px)**: single column. Calendar switches to list view (chronological post list). Bulk cadence strip scrolls horizontally.

---

## Error Handling

- **Upload failure**: toast notification with retry button. Files that fail don't block others.
- **AI generation failure**: show error in the review card with "Retry Generation" button. Allow manual caption entry as fallback.
- **Schedule failure**: toast with error message. Post stays in review state.
- **Publish failure**: post marked as `failed` in calendar with retry button. Activity feed logs the error. Error message stored in `scheduled_posts.error_message`.
- **Token expiry**: if refresh fails during cron, log the error and skip all posts for that brand. Activity feed shows "Instagram connection expired — please reconnect" event.

---

## Feature Flags

Both major pieces can be gated independently:

- `FEATURE_CONTENT_AUTOMATION`: controls the tab visibility in nav
- `FEATURE_BULK_CADENCE`: controls bulk mode toggle in upload zone

Flags stored as environment variables, checked in the portal layout.

---

## Out of Scope (Module 2 — AI Creative Generator)

The following are intentionally deferred to the next spec cycle:

- Text-to-visual generation (prompt → image)
- Asset remix (upload → AI overlay/treatment)
- Brief upload → extraction → generation
- In-browser canvas editor for text/color tweaks
- Reel script + storyboard generation
- Multi-format output (1:1 + 4:5 simultaneously)
- Variant comparison (3 variants per prompt)
