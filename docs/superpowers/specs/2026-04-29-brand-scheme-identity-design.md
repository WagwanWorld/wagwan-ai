# Brand Scheme & Identity Section — Design Spec

**Date:** 2026-04-29  
**Status:** Approved  
**Location:** Content Studio → Brand OS Dashboard → Row 6 (replaces Brand Direction + Brand Style)

## Overview

Replace the existing compact Row 6 (Brand Direction + Brand Style cards) in `BrandOsDashboard.svelte` with a rich, full-width Brand Scheme & Identity section. The section scrapes the brand's website + uses existing Instagram data to extract colors, typography, logo, and generates application mockups — all rendered in a 3-column magazine-style grid.

## Data Sources

1. **Instagram Graph API** — existing integration, provides profile pic, bio, website URL, recent posts
2. **Website scraping** — new server-side HTML fetch + CSS parsing to extract colors, fonts, logo, tagline
3. **LLM refinement** — Claude takes raw extractions and produces named colors, font pairings, tagline, and application descriptions

## Data Pipeline

### Website Scraper Module

**File:** `src/lib/server/brand/websiteScraper.ts`

Accepts a URL and returns raw brand signals:

- **Colors**: Parse inline styles, `<style>` tags, and linked CSS for hex/rgb values. Rank by frequency. Deduplicate near-identical colors (within deltaE threshold).
- **Fonts**: Extract `font-family` from CSS declarations. Detect Google Fonts (`fonts.googleapis.com`) and Adobe Fonts (`use.typekit.net`) link tags.
- **Logo**: Check in order: `<link rel="icon" type="image/png">`, `<link rel="apple-touch-icon">`, `og:image` meta, then heuristic `<img>` scan for elements with "logo" in src/alt/class attributes. Store as absolute URLs.
- **Tagline**: `og:description` meta, `meta[name=description]`, or first `<h1>` / hero text element.

### API Endpoint

**`POST /api/brand/os-scrape-identity`**

Input:
```json
{
  "brandAccountId": "uuid",
  "websiteUrl": "https://example.com" // optional, falls back to IG website field
}
```

Flow:
1. Resolve URL: use provided `websiteUrl`, or fall back to `brand_accounts.website` from Instagram
2. Call `websiteScraper.scrape(url)` → raw extractions
3. Load existing Instagram data (profile pic, bio, recent post thumbnails)
4. LLM call (Claude Haiku) to refine raw data into `BrandScheme` object:
   - Name the colors with evocative single-word names
   - Assign color roles (primary, secondary, accent, neutral, background)
   - Identify heading vs body font pairing
   - Clean up tagline
   - Generate application descriptions (how brand looks on IG post, business card, website header, social banner)
5. Store in `brand_snapshots.intelligence.brandScheme` (JSONB)
6. Return `BrandScheme` object

### LLM Prompt Strategy

System prompt instructs Claude to act as a brand identity analyst. Input: raw scraped colors (hex list + frequencies), font families, logo URLs, tagline candidates, Instagram bio, recent post themes. Output: structured `BrandScheme` JSON matching the type definition.

## Data Model

### `BrandScheme` type (added to `src/lib/types/brand-os.ts`)

```typescript
export interface BrandSchemeColor {
  name: string;       // AI-generated ("Ember", "Void", "Chalk")
  hex: string;        // #E8833A
  role: 'primary' | 'secondary' | 'accent' | 'neutral' | 'background';
}

export interface BrandSchemeFont {
  family: string;     // "PP Mori", "Inter"
  weights: number[];  // [400, 600, 700]
  source: 'google' | 'adobe' | 'system' | 'custom';
}

export interface BrandScheme {
  scrapedAt: string;
  sourceUrl: string;

  logo: {
    darkUrl: string | null;
    lightUrl: string | null;
    faviconUrl: string | null;
  };

  palette: BrandSchemeColor[];

  typography: {
    heading: BrandSchemeFont;
    body: BrandSchemeFont;
    mono?: BrandSchemeFont;
  };

  tagline: string | null;

  applications: {
    igPost: string;
    businessCard: string;
    websiteHeader: string;
    socialBanner: string;
  };
}
```

### Storage

Stored inside existing `brand_snapshots.intelligence` JSONB column as `intelligence.brandScheme`. No database migration needed.

### Dashboard Type Extension

`BrandOsDashboard` gains:
```typescript
brandScheme?: BrandScheme;
```

The `/api/brand/os-dashboard` GET endpoint reads `intelligence.brandScheme` from the latest snapshot and includes it in the response.

## UI Design

### Component

**New file:** `src/lib/components/brands/BrandSchemeSection.svelte`

**Props:**
- `brandScheme: BrandScheme | null`
- `brandName: string`
- `syncing: boolean`
- `onRescan: (url?: string) => void`

### Layout — 3-Column Grid (replaces Row 6)

**Row A — Header (span 3):**
- Logo image (72px rounded square, with dark bg) + brand name (20px bold) + website URL (mono, muted) + tagline (italic)
- Right side: "Scraped Xh ago" timestamp badge + "Rescan" button
- If no scheme exists: URL input field + "Scan Website" CTA button

**Row B — Three Cards:**

1. **Color Palette (span 1):**
   - `PALETTE` label
   - Grid of swatches: 48px blocks with rounded corners, drop shadow
   - Below each: color name + hex code
   - Role indicated by subtle border treatment (primary gets brand-colored ring)

2. **Typography (span 1):**
   - `TYPOGRAPHY` label
   - Heading specimen: font name tag (orange), sample text at 22px bold, weight chips
   - Body specimen: font name tag, sample text at 13px, weight chips
   - Optional mono specimen if detected

3. **Logo System (span 1):**
   - `LOGO SYSTEM` label
   - Two squares side by side: dark variant (dark bg) + light variant (light bg)
   - Fallback: favicon or brand initial in styled circle
   - Caption: "DARK / LIGHT VARIANTS"

**Row C — Application Examples (span 3):**
- `APPLICATION EXAMPLES` label
- Four side-by-side mockup cards rendered using the brand's actual extracted colors:
  - Instagram Post: square format, brand colors as bg gradient, sample text
  - Business Card: landscape format, logo circle + text bars in brand palette
  - Website Header: nav bar mockup with brand accent color
  - Social Banner: wide format with gradient + text overlay

### States

1. **Empty (no brandScheme):** Single card spanning full width with URL input + "Scan your website to build your brand identity" message + scan button
2. **Scanning:** Skeleton shimmer matching the full 3-column grid layout
3. **Loaded:** Full grid with all sections populated
4. **Partial data:** Sections gracefully hide if data is missing (no mono font = no mono row, no logo = initial fallback)

### Styling

Matches existing dashboard design system:
- `bs-card` base class for cards
- Monospace labels: `'Geist Mono Variable', 'SF Mono', monospace` at 8px uppercase
- Colors: `#EDEDEF` (text), `#8A8A92` (muted), `#4A4A50` (labels), `#E8833A` (accent)
- Background: `rgba(255,255,255,0.03)` cards, `rgba(255,255,255,0.06)` borders
- Border radius: 14px cards, 10px inner elements

## Integration

### Dashboard Component Changes

In `BrandOsDashboard.svelte`:
- Remove current Row 6 markup (lines 364-446: Brand Direction + Brand Style cards)
- Import and render `<BrandSchemeSection>` in its place
- Pass `dashboard.brandScheme`, `dashboard.executive.brandName`, `syncing`, and rescan handler

### Scrape Triggers

1. **Manual rescan:** User clicks "Rescan" in the header → calls `POST /api/brand/os-scrape-identity`
2. **Manual URL entry:** User enters URL in empty state → calls same endpoint with `websiteUrl`
3. **Auto on first load:** If `brandScheme` is null and brand has a `website` field, auto-trigger scrape
4. **Deep analysis integration:** The existing analysis flow gains optional identity phase (scrape if stale >7 days)

### URL Resolution

Priority:
1. User-provided URL (from input field or rescan)
2. `brand_accounts.website` field (from Instagram Graph API)
3. Instagram profile URL as fallback (limited extraction)

## Files Changed

| File | Change |
|------|--------|
| `src/lib/types/brand-os.ts` | Add `BrandScheme` types, extend `BrandOsDashboard` |
| `src/lib/server/brand/websiteScraper.ts` | **New** — website HTML/CSS scraping module |
| `src/routes/api/brand/os-scrape-identity/+server.ts` | **New** — POST endpoint |
| `src/routes/api/brand/os-dashboard/+server.ts` | Read `brandScheme` from intelligence JSONB |
| `src/lib/components/brands/BrandSchemeSection.svelte` | **New** — full identity grid component |
| `src/lib/components/brands/BrandOsDashboard.svelte` | Replace Row 6 with BrandSchemeSection |

## Out of Scope

- Voice & Tone analysis
- Visual Style / photography direction analysis
- Mood board generation
- Brand guidelines PDF export
- Manual asset upload (logo files, brand guide PDFs)
