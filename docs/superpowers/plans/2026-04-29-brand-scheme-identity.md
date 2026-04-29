# Brand Scheme & Identity Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dashboard's Row 6 (Brand Direction + Brand Style) with a rich Brand Scheme & Identity section that scrapes a brand's website to extract colors, fonts, logo, and tagline, then renders them in a 3-column magazine-style grid with application mockups.

**Architecture:** A new `websiteScraper.ts` module fetches website HTML and parses CSS for brand signals. A new API endpoint `/api/brand/os-scrape-identity` orchestrates scraping + LLM refinement (Claude Haiku) to produce a `BrandScheme` object stored in the existing `brand_snapshots.intelligence` JSONB. The dashboard API reads it out, and a new `BrandSchemeSection.svelte` component renders the 3-column grid.

**Tech Stack:** SvelteKit, TypeScript, Anthropic SDK (Claude Haiku), native `fetch` for scraping, regex-based CSS/HTML parsing

**Spec:** `docs/superpowers/specs/2026-04-29-brand-scheme-identity-design.md`

---

### Task 1: Add BrandScheme types

**Files:**
- Modify: `src/lib/types/brand-os.ts:92-116`

- [ ] **Step 1: Add BrandScheme interfaces before BrandOsDashboard**

Open `src/lib/types/brand-os.ts`. Before the `BrandOsDashboard` interface (line 93), add:

```typescript
export interface BrandSchemeColor {
  name: string;
  hex: string;
  role: 'primary' | 'secondary' | 'accent' | 'neutral' | 'background';
}

export interface BrandSchemeFont {
  family: string;
  weights: number[];
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

- [ ] **Step 2: Add `brandScheme` to BrandOsDashboard interface**

In the `BrandOsDashboard` interface, after `creatorMatches: CreatorMatch[];` (line 115), add:

```typescript
  brandScheme?: BrandScheme;
```

- [ ] **Step 3: Verify types compile**

Run: `npx svelte-check --threshold error 2>&1 | head -20`
Expected: No new errors from these type additions.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/brand-os.ts
git commit -m "feat: add BrandScheme types for brand identity extraction"
```

---

### Task 2: Build the website scraper module

**Files:**
- Create: `src/lib/server/brand/websiteScraper.ts`

This module fetches a website's HTML and extracts raw brand signals (colors, fonts, logo URLs, tagline). It does NOT call any LLM — it returns raw parsed data for the API endpoint to refine.

- [ ] **Step 1: Create the scraper module**

Create `src/lib/server/brand/websiteScraper.ts`:

```typescript
/**
 * Website scraper for brand identity extraction.
 * Fetches HTML + CSS and extracts colors, fonts, logo URLs, and tagline.
 */

export interface RawBrandSignals {
  colors: { hex: string; frequency: number }[];
  fonts: { family: string; source: 'google' | 'adobe' | 'system' | 'custom' }[];
  logoUrls: string[];
  faviconUrl: string | null;
  tagline: string | null;
  title: string | null;
  ogImage: string | null;
}

/** Normalize a potentially relative URL against a base */
function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

/** Extract all hex colors from CSS text, return with frequency count */
function extractColors(css: string): { hex: string; frequency: number }[] {
  const hexPattern = /#(?:[0-9a-fA-F]{3}){1,2}\b/g;
  const rgbPattern = /rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/g;
  const counts = new Map<string, number>();

  // Hex colors
  for (const match of css.matchAll(hexPattern)) {
    let hex = match[0].toLowerCase();
    // Expand shorthand #abc → #aabbcc
    if (hex.length === 4) {
      hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
    }
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  // RGB colors → convert to hex
  for (const match of css.matchAll(rgbPattern)) {
    const r = parseInt(match[1]);
    const g = parseInt(match[2]);
    const b = parseInt(match[3]);
    if (r <= 255 && g <= 255 && b <= 255) {
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`.toLowerCase();
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
  }

  // Filter out near-black (#000, #111, etc.) and near-white (#fff, #fefefe, etc.)
  // but keep them if they appear very frequently (likely intentional brand colors)
  const filtered = [...counts.entries()]
    .map(([hex, frequency]) => ({ hex, frequency }))
    .sort((a, b) => b.frequency - a.frequency);

  // Deduplicate similar colors (within 30 units in RGB space)
  const deduped: typeof filtered = [];
  for (const color of filtered) {
    const r1 = parseInt(color.hex.slice(1, 3), 16);
    const g1 = parseInt(color.hex.slice(3, 5), 16);
    const b1 = parseInt(color.hex.slice(5, 7), 16);
    const tooClose = deduped.some((d) => {
      const r2 = parseInt(d.hex.slice(1, 3), 16);
      const g2 = parseInt(d.hex.slice(3, 5), 16);
      const b2 = parseInt(d.hex.slice(5, 7), 16);
      return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2) < 30;
    });
    if (!tooClose) deduped.push(color);
  }

  return deduped.slice(0, 20);
}

/** Extract font families from CSS text */
function extractFonts(css: string, html: string): { family: string; source: 'google' | 'adobe' | 'system' | 'custom' }[] {
  const fontFamilyPattern = /font-family\s*:\s*([^;}"]+)/gi;
  const seen = new Set<string>();
  const fonts: { family: string; source: 'google' | 'adobe' | 'system' | 'custom' }[] = [];

  const systemFonts = new Set([
    'serif', 'sans-serif', 'monospace', 'cursive', 'fantasy', 'system-ui',
    'ui-serif', 'ui-sans-serif', 'ui-monospace', 'ui-rounded',
    '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'arial', 'helvetica',
    'times new roman', 'times', 'courier new', 'courier', 'verdana', 'georgia',
    'palatino', 'garamond', 'bookman', 'tahoma', 'trebuchet ms', 'impact',
    'inherit', 'initial', 'unset',
  ]);

  // Check for Google Fonts
  const googleFontsPattern = /fonts\.googleapis\.com\/css2?\?family=([^"&\s]+)/g;
  for (const match of html.matchAll(googleFontsPattern)) {
    const families = decodeURIComponent(match[1]).split('|');
    for (const fam of families) {
      const name = fam.split(':')[0].replace(/\+/g, ' ').trim();
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        fonts.push({ family: name, source: 'google' });
      }
    }
  }

  // Check for Adobe Fonts
  const hasAdobe = html.includes('use.typekit.net');

  // Extract from font-family declarations
  for (const match of css.matchAll(fontFamilyPattern)) {
    const families = match[1].split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''));
    for (const family of families) {
      const lower = family.toLowerCase();
      if (!lower || systemFonts.has(lower) || seen.has(lower)) continue;
      seen.add(lower);
      const source = fonts.some((f) => f.family.toLowerCase() === lower)
        ? fonts.find((f) => f.family.toLowerCase() === lower)!.source
        : hasAdobe ? 'adobe' : 'custom';
      if (!fonts.some((f) => f.family.toLowerCase() === lower)) {
        fonts.push({ family, source });
      }
    }
  }

  return fonts.slice(0, 10);
}

/** Extract logo URLs from HTML */
function extractLogos(html: string, baseUrl: string): { logoUrls: string[]; faviconUrl: string | null } {
  const logos: string[] = [];
  let faviconUrl: string | null = null;

  // Apple touch icon
  const appleTouchMatch = html.match(/<link[^>]*rel=["']apple-touch-icon["'][^>]*href=["']([^"']+)["']/i);
  if (appleTouchMatch) {
    logos.push(resolveUrl(appleTouchMatch[1], baseUrl));
  }

  // Favicon (PNG preferred)
  const faviconPngMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*type=["']image\/png["'][^>]*href=["']([^"']+)["']/i)
    || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["'][^>]*type=["']image\/png["']/i);
  if (faviconPngMatch) {
    faviconUrl = resolveUrl(faviconPngMatch[1], baseUrl);
  }

  // Any favicon
  if (!faviconUrl) {
    const faviconMatch = html.match(/<link[^>]*rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i)
      || html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i);
    if (faviconMatch) {
      faviconUrl = resolveUrl(faviconMatch[1], baseUrl);
    }
  }

  // OG image (often a logo or hero image)
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  const ogImage = ogImageMatch ? resolveUrl(ogImageMatch[1], baseUrl) : null;
  if (ogImage) logos.push(ogImage);

  // Images with "logo" in src, alt, or class
  const imgLogoPattern = /<img[^>]*(?:src|alt|class)=["'][^"']*logo[^"']*["'][^>]*>/gi;
  for (const match of html.matchAll(imgLogoPattern)) {
    const srcMatch = match[0].match(/src=["']([^"']+)["']/i);
    if (srcMatch) {
      logos.push(resolveUrl(srcMatch[1], baseUrl));
    }
  }

  // SVG with "logo" in class or id
  const svgLogoPattern = /<svg[^>]*(?:class|id)=["'][^"']*logo[^"']*["'][^>]*/gi;
  if (svgLogoPattern.test(html)) {
    // SVGs are inline — we note their presence but can't extract a URL
    // The LLM will use favicon/og:image instead
  }

  return { logoUrls: [...new Set(logos)].slice(0, 5), faviconUrl };
}

/** Extract tagline / description from HTML */
function extractTagline(html: string): string | null {
  // og:description
  const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  if (ogDescMatch?.[1]?.trim()) return ogDescMatch[1].trim();

  // meta description
  const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  if (descMatch?.[1]?.trim()) return descMatch[1].trim();

  // First h1
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  if (h1Match?.[1]?.trim() && h1Match[1].trim().length < 200) return h1Match[1].trim();

  return null;
}

/**
 * Scrape a website and extract raw brand signals.
 * This is a pure extraction step — no LLM involved.
 */
export async function scrapeWebsiteIdentity(url: string): Promise<RawBrandSignals> {
  let fetchUrl = url.trim();
  if (!fetchUrl.startsWith('http')) fetchUrl = 'https://' + fetchUrl;

  const res = await fetch(fetchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Wagwan/1.0; +https://wagwan.ai)',
      'Accept': 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`Failed to fetch ${fetchUrl}: ${res.status}`);
  const html = await res.text();
  const baseUrl = new URL(fetchUrl).origin;

  // Collect all CSS: inline styles + <style> blocks
  let allCss = '';
  const styleBlocks = html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);
  for (const block of styleBlocks) {
    allCss += block[1] + '\n';
  }

  // Also extract inline style attributes
  const inlineStyles = html.matchAll(/style=["']([^"']+)["']/gi);
  for (const s of inlineStyles) {
    allCss += s[1] + '\n';
  }

  // Attempt to fetch linked stylesheets (first 3 only, with timeout)
  const linkPattern = /<link[^>]*rel=["']stylesheet["'][^>]*href=["']([^"']+)["']/gi;
  const cssLinks: string[] = [];
  for (const match of html.matchAll(linkPattern)) {
    cssLinks.push(resolveUrl(match[1], baseUrl));
    if (cssLinks.length >= 3) break;
  }

  const cssResults = await Promise.allSettled(
    cssLinks.map((href) =>
      fetch(href, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Wagwan/1.0)' },
        signal: AbortSignal.timeout(5000),
      }).then((r) => (r.ok ? r.text() : ''))
    ),
  );
  for (const result of cssResults) {
    if (result.status === 'fulfilled' && result.value) {
      allCss += result.value + '\n';
    }
  }

  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? null;

  // OG image
  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  const ogImage = ogImageMatch ? resolveUrl(ogImageMatch[1], baseUrl) : null;

  const colors = extractColors(allCss);
  const fonts = extractFonts(allCss, html);
  const { logoUrls, faviconUrl } = extractLogos(html, baseUrl);
  const tagline = extractTagline(html);

  return { colors, fonts, logoUrls, faviconUrl, tagline, title, ogImage };
}
```

- [ ] **Step 2: Verify the module compiles**

Run: `npx tsc --noEmit src/lib/server/brand/websiteScraper.ts 2>&1 | head -10`

If tsc doesn't work standalone with SvelteKit paths, run:
`npx svelte-check --threshold error 2>&1 | tail -5`

Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/brand/websiteScraper.ts
git commit -m "feat: add website scraper module for brand identity extraction"
```

---

### Task 3: Create the scrape-identity API endpoint

**Files:**
- Create: `src/routes/api/brand/os-scrape-identity/+server.ts`

This endpoint orchestrates: URL resolution → scraping → LLM refinement → storage. Follows the same auth + Supabase patterns as `os-analyse/+server.ts`.

- [ ] **Step 1: Create the endpoint**

Create `src/routes/api/brand/os-scrape-identity/+server.ts`:

```typescript
import { error, json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { getServiceSupabase } from '$lib/server/supabase';
import { ANTHROPIC_API_KEY } from '$env/static/private';
import Anthropic from '@anthropic-ai/sdk';
import { scrapeWebsiteIdentity } from '$lib/server/brand/websiteScraper';
import type { BrandScheme } from '$lib/types/brand-os';

function extractJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  return s;
}

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand session required');

  const body = await request.json().catch(() => ({}));
  const providedUrl = body?.websiteUrl?.trim() || '';

  const sb = getServiceSupabase();

  // Load brand account + latest snapshot
  const [brandRes, snapRes] = await Promise.all([
    sb.from('brand_accounts')
      .select('ig_name,ig_username,ig_followers_count,brand_identity,ig_access_token')
      .eq('ig_user_id', igUserId)
      .maybeSingle(),
    sb.from('brand_snapshots')
      .select('id,intelligence')
      .eq('brand_ig_id', igUserId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  if (!brandRes.data) throw error(404, 'Brand account not found');
  if (!snapRes.data) throw error(400, 'No snapshot found. Run initial data sync first.');

  const brand = brandRes.data;
  const snapshot = snapRes.data;
  const intel = (snapshot.intelligence as Record<string, any>) || {};

  // Resolve website URL
  const websiteUrl = providedUrl
    || (brand.brand_identity as any)?.website
    || intel.identity?.website
    || '';

  if (!websiteUrl) {
    return json({ ok: false, error: 'No website URL available. Please provide one.' }, { status: 400 });
  }

  try {
    // 1. Scrape website
    console.log(`[os-scrape-identity] Scraping ${websiteUrl} for ${igUserId}`);
    const raw = await scrapeWebsiteIdentity(websiteUrl);

    // 2. Build context from Instagram data
    const identity = intel.identity || {};
    const igContext = {
      name: brand.ig_name || '',
      handle: brand.ig_username || '',
      followers: brand.ig_followers_count || 0,
      bio: identity.rawSummary || identity.description || '',
      interests: (identity.interests || []).slice(0, 8),
      aesthetic: identity.aesthetic || '',
    };

    // 3. LLM refinement
    const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

    const prompt = `You are a brand identity analyst. I've scraped a brand's website and have their Instagram data. Analyze these raw signals and produce a refined brand identity scheme.

## Raw Website Data
- URL: ${websiteUrl}
- Title: ${raw.title || 'N/A'}
- Tagline/description: ${raw.tagline || 'N/A'}
- Colors found (hex, frequency): ${raw.colors.slice(0, 15).map((c) => `${c.hex} (${c.frequency}x)`).join(', ')}
- Fonts found: ${raw.fonts.map((f) => `${f.family} (${f.source})`).join(', ') || 'None detected'}
- Logo URLs: ${raw.logoUrls.join(', ') || 'None found'}
- Favicon: ${raw.faviconUrl || 'None'}
- OG image: ${raw.ogImage || 'None'}

## Instagram Data
- Name: ${igContext.name}
- Handle: @${igContext.handle}
- Followers: ${igContext.followers}
- Bio: ${igContext.bio}
- Interests: ${igContext.interests.join(', ')}
- Aesthetic: ${igContext.aesthetic}

## Your Task
Create a refined brand identity scheme. For each color, give it an evocative single-word name (like "Ember", "Void", "Chalk") and assign a role. Identify the heading vs body font. Write a clean tagline if the scraped one is too long or generic. For each application example, describe in 1-2 sentences how the brand would look in that format using its actual colors and style.

Pick the 4-6 most important/distinctive colors from the scraped data. Skip generic blacks/whites unless they are clearly intentional brand colors (e.g. a brand with a dark theme).

Respond with ONLY valid JSON matching this exact structure:
{
  "palette": [
    { "name": "EvocativeName", "hex": "#hexval", "role": "primary|secondary|accent|neutral|background" }
  ],
  "typography": {
    "heading": { "family": "Font Name", "weights": [400, 700], "source": "google|adobe|system|custom" },
    "body": { "family": "Font Name", "weights": [400, 500], "source": "google|adobe|system|custom" }
  },
  "tagline": "Clean brand tagline or null",
  "logo": {
    "darkUrl": "url or null",
    "lightUrl": "url or null",
    "faviconUrl": "url or null"
  },
  "applications": {
    "igPost": "How an IG post looks with this brand identity",
    "businessCard": "How a business card looks",
    "websiteHeader": "How the website header looks",
    "socialBanner": "How a social banner looks"
  }
}`;

    const res = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = res.content[0].type === 'text' ? res.content[0].text : '';
    const parsed = JSON.parse(extractJson(text));

    // Construct the full BrandScheme object
    const brandScheme: BrandScheme = {
      scrapedAt: new Date().toISOString(),
      sourceUrl: websiteUrl,
      logo: {
        darkUrl: parsed.logo?.darkUrl || raw.logoUrls[0] || null,
        lightUrl: parsed.logo?.lightUrl || null,
        faviconUrl: parsed.logo?.faviconUrl || raw.faviconUrl || null,
      },
      palette: Array.isArray(parsed.palette) ? parsed.palette : [],
      typography: parsed.typography || {
        heading: { family: raw.fonts[0]?.family || 'System', weights: [400, 700], source: raw.fonts[0]?.source || 'system' },
        body: { family: raw.fonts[1]?.family || raw.fonts[0]?.family || 'System', weights: [400, 500], source: raw.fonts[1]?.source || 'system' },
      },
      tagline: parsed.tagline || raw.tagline || null,
      applications: parsed.applications || {
        igPost: 'Brand-styled Instagram post',
        businessCard: 'Brand-styled business card',
        websiteHeader: 'Brand-styled website header',
        socialBanner: 'Brand-styled social banner',
      },
    };

    // 4. Store in intelligence JSONB
    intel.brandScheme = brandScheme;
    await sb.from('brand_snapshots')
      .update({ intelligence: intel })
      .eq('id', snapshot.id);

    console.log(`[os-scrape-identity] Saved brand scheme for ${igUserId}`);
    return json({ ok: true, brandScheme });
  } catch (err) {
    console.error('[os-scrape-identity] Error:', err);
    return json({
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to scrape website',
    }, { status: 500 });
  }
};
```

- [ ] **Step 2: Verify endpoint compiles**

Run: `npx svelte-check --threshold error 2>&1 | tail -10`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/brand/os-scrape-identity/+server.ts
git commit -m "feat: add POST /api/brand/os-scrape-identity endpoint"
```

---

### Task 4: Wire brandScheme into the dashboard API response

**Files:**
- Modify: `src/routes/api/brand/os-dashboard/+server.ts:241-448`

The dashboard GET endpoint already reads `latestIntel` from `brand_snapshots.intelligence`. We just need to include `brandScheme` in the response.

- [ ] **Step 1: Add brandScheme to the dashboard response object**

In `src/routes/api/brand/os-dashboard/+server.ts`, find the `const dashboard: BrandOsDashboard = {` block (line 241). After the `creatorMatches,` line (around line 433), add:

```typescript
    brandScheme: latestIntel.brandScheme || undefined,
```

This goes right before the `contentOps:` property.

- [ ] **Step 2: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | tail -10`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/brand/os-dashboard/+server.ts
git commit -m "feat: include brandScheme in dashboard API response"
```

---

### Task 5: Build the BrandSchemeSection Svelte component

**Files:**
- Create: `src/lib/components/brands/BrandSchemeSection.svelte`

This is the largest task — the full 3-column identity grid UI.

- [ ] **Step 1: Create the component**

Create `src/lib/components/brands/BrandSchemeSection.svelte`:

```svelte
<script lang="ts">
  import type { BrandScheme } from '$lib/types/brand-os';

  export let brandScheme: BrandScheme | null = null;
  export let brandName: string = '';
  export let syncing: boolean = false;
  export let onRescan: (url?: string) => void = () => {};

  let urlInput = '';
  let scanning = false;

  function timeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }

  function handleScan() {
    if (!urlInput.trim() && !brandScheme?.sourceUrl) return;
    scanning = true;
    onRescan(urlInput.trim() || undefined);
  }

  function handleRescan() {
    scanning = true;
    onRescan();
  }

  // Reactively reset scanning when brandScheme changes
  $: if (brandScheme) scanning = false;

  // First letter fallback for logo
  $: brandInitial = (brandName || '?')[0].toUpperCase();
</script>

{#if !brandScheme && !scanning}
  <!-- ── EMPTY STATE: URL input ── -->
  <div class="bsi-empty">
    <span class="bsi-label">BRAND SCHEME</span>
    <p class="bsi-empty-msg">Scan your website to build your brand identity — colors, fonts, logo, and application mockups.</p>
    <div class="bsi-url-row">
      <input
        class="bsi-url-input"
        type="url"
        bind:value={urlInput}
        placeholder="https://yourbrand.com"
        on:keydown={(e) => e.key === 'Enter' && handleScan()}
      />
      <button class="bsi-scan-btn" on:click={handleScan} disabled={!urlInput.trim()}>
        Scan Website
      </button>
    </div>
  </div>

{:else if scanning && !brandScheme}
  <!-- ── SCANNING STATE: skeleton ── -->
  <div class="bsi-grid">
    <div class="bsi-header bsi-skeleton-header">
      <div class="bsi-skel bsi-skel-logo"></div>
      <div class="bsi-skel-text-group">
        <div class="bsi-skel bsi-skel-title"></div>
        <div class="bsi-skel bsi-skel-subtitle"></div>
      </div>
    </div>
    {#each [1, 2, 3] as _}
      <div class="bs-card bsi-skel-card">
        <div class="bsi-skel bsi-skel-label"></div>
        <div class="bsi-skel bsi-skel-block"></div>
        <div class="bsi-skel bsi-skel-block-sm"></div>
      </div>
    {/each}
  </div>

{:else if brandScheme}
  <!-- ── LOADED STATE: full identity grid ── -->
  <div class="bsi-grid">
    <!-- Row A: Header -->
    <div class="bsi-header">
      <div class="bsi-logo-wrap">
        {#if brandScheme.logo.darkUrl || brandScheme.logo.faviconUrl}
          <img
            class="bsi-logo-img"
            src={brandScheme.logo.darkUrl || brandScheme.logo.faviconUrl}
            alt="{brandName} logo"
          />
        {:else}
          <div class="bsi-logo-initial">{brandInitial}</div>
        {/if}
      </div>
      <div class="bsi-header-info">
        <span class="bsi-brand-name">{brandName}</span>
        <span class="bsi-brand-url">{brandScheme.sourceUrl}</span>
        {#if brandScheme.tagline}
          <span class="bsi-brand-tagline">"{brandScheme.tagline}"</span>
        {/if}
      </div>
      <div class="bsi-header-actions">
        <span class="bsi-scraped-badge">SCRAPED {timeAgo(brandScheme.scrapedAt).toUpperCase()}</span>
        <button class="bsi-rescan-btn" on:click={handleRescan} disabled={syncing}>
          <span class="bsi-rescan-icon">&#8635;</span>
          {syncing ? 'Scanning...' : 'RESCAN'}
        </button>
      </div>
    </div>

    <!-- Row B: Three cards -->

    <!-- Color Palette -->
    <div class="bs-card bsi-palette-card">
      <span class="bsi-label">COLOR PALETTE</span>
      <div class="bsi-palette-grid">
        {#each brandScheme.palette as color}
          <div class="bsi-swatch" title="{color.role}">
            <div
              class="bsi-swatch-block"
              style="background:{color.hex}"
              class:bsi-swatch-primary={color.role === 'primary'}
            ></div>
            <span class="bsi-swatch-name">{color.name}</span>
            <span class="bsi-swatch-hex">{color.hex}</span>
          </div>
        {/each}
      </div>
    </div>

    <!-- Typography -->
    <div class="bs-card bsi-typo-card">
      <span class="bsi-label">TYPOGRAPHY</span>
      <div class="bsi-typo-specimens">
        <div class="bsi-typo-specimen">
          <span class="bsi-typo-font-name">Heading — {brandScheme.typography.heading.family}</span>
          <span class="bsi-typo-sample" style="font-family:'{brandScheme.typography.heading.family}', sans-serif">
            The quick brown fox
          </span>
          <div class="bsi-typo-weights">
            {#each brandScheme.typography.heading.weights as w}
              <span class="bsi-typo-weight-chip">{w}</span>
            {/each}
            <span class="bsi-typo-source-chip">{brandScheme.typography.heading.source}</span>
          </div>
        </div>
        <div class="bsi-typo-specimen">
          <span class="bsi-typo-font-name">Body — {brandScheme.typography.body.family}</span>
          <span class="bsi-typo-sample-body" style="font-family:'{brandScheme.typography.body.family}', sans-serif">
            Aa Bb Cc Dd Ee Ff Gg Hh Ii Jj Kk
          </span>
          <div class="bsi-typo-weights">
            {#each brandScheme.typography.body.weights as w}
              <span class="bsi-typo-weight-chip">{w}</span>
            {/each}
            <span class="bsi-typo-source-chip">{brandScheme.typography.body.source}</span>
          </div>
        </div>
        {#if brandScheme.typography.mono}
          <div class="bsi-typo-specimen">
            <span class="bsi-typo-font-name">Mono — {brandScheme.typography.mono.family}</span>
            <span class="bsi-typo-sample-body" style="font-family:'{brandScheme.typography.mono.family}', monospace">
              0123456789 {}[]()
            </span>
            <div class="bsi-typo-weights">
              {#each brandScheme.typography.mono.weights as w}
                <span class="bsi-typo-weight-chip">{w}</span>
              {/each}
              <span class="bsi-typo-source-chip">{brandScheme.typography.mono.source}</span>
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Logo System -->
    <div class="bs-card bsi-logo-card">
      <span class="bsi-label">LOGO SYSTEM</span>
      <div class="bsi-logo-variants">
        <div class="bsi-logo-variant bsi-logo-dark">
          {#if brandScheme.logo.darkUrl}
            <img src={brandScheme.logo.darkUrl} alt="Logo (dark)" />
          {:else if brandScheme.logo.faviconUrl}
            <img src={brandScheme.logo.faviconUrl} alt="Favicon" />
          {:else}
            <div class="bsi-logo-initial-lg">{brandInitial}</div>
          {/if}
        </div>
        <div class="bsi-logo-variant bsi-logo-light">
          {#if brandScheme.logo.lightUrl}
            <img src={brandScheme.logo.lightUrl} alt="Logo (light)" />
          {:else if brandScheme.logo.darkUrl || brandScheme.logo.faviconUrl}
            <img src={brandScheme.logo.darkUrl || brandScheme.logo.faviconUrl} alt="Logo" style="filter:invert(1)" />
          {:else}
            <div class="bsi-logo-initial-lg" style="color:#0D0D0F">{brandInitial}</div>
          {/if}
        </div>
      </div>
      <span class="bsi-logo-caption">DARK / LIGHT VARIANTS</span>
    </div>

    <!-- Row C: Application Examples -->
    <div class="bs-card bsi-apps-card">
      <span class="bsi-label">APPLICATION EXAMPLES</span>
      <div class="bsi-apps-grid">
        {#each [
          { label: 'Instagram Post', desc: brandScheme.applications.igPost, aspect: '1/1' },
          { label: 'Business Card', desc: brandScheme.applications.businessCard, aspect: '1.6/1' },
          { label: 'Website Header', desc: brandScheme.applications.websiteHeader, aspect: '3/1' },
          { label: 'Social Banner', desc: brandScheme.applications.socialBanner, aspect: '16/9' },
        ] as app}
          <div class="bsi-app-mock">
            <div class="bsi-app-mock-header">{app.label}</div>
            <div
              class="bsi-app-mock-body"
              style="aspect-ratio:{app.aspect}; background: linear-gradient(135deg, {brandScheme.palette[0]?.hex || '#E8833A'}11, {brandScheme.palette[1]?.hex || '#0D0D0F'}08)"
            >
              <p class="bsi-app-mock-desc">{app.desc}</p>
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  /* ── Layout ── */
  .bsi-grid {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 14px;
  }

  /* ── Empty state ── */
  .bsi-empty {
    grid-column: span 3;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
    padding: 32px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    text-align: center;
  }
  .bsi-empty-msg {
    font-size: 13px;
    color: #8A8A92;
    line-height: 1.6;
    max-width: 420px;
  }
  .bsi-url-row {
    display: flex;
    gap: 8px;
    width: 100%;
    max-width: 440px;
  }
  .bsi-url-input {
    flex: 1;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 8px;
    padding: 10px 14px;
    color: #EDEDEF;
    font-size: 13px;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    outline: none;
  }
  .bsi-url-input:focus {
    border-color: rgba(232,131,58,0.5);
  }
  .bsi-url-input::placeholder {
    color: #4A4A50;
  }
  .bsi-scan-btn {
    background: rgba(232,131,58,0.15);
    border: 1px solid rgba(232,131,58,0.4);
    border-radius: 8px;
    padding: 10px 18px;
    color: #E8833A;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: all 0.15s ease;
  }
  .bsi-scan-btn:hover:not(:disabled) {
    background: rgba(232,131,58,0.25);
  }
  .bsi-scan-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* ── Header ── */
  .bsi-header {
    grid-column: span 3;
    display: flex;
    align-items: center;
    gap: 20px;
    padding: 20px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 14px;
  }
  .bsi-logo-wrap {
    width: 72px;
    height: 72px;
    border-radius: 14px;
    overflow: hidden;
    flex-shrink: 0;
    background: rgba(255,255,255,0.04);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .bsi-logo-img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .bsi-logo-initial {
    font-size: 28px;
    font-weight: 700;
    color: #E8833A;
  }
  .bsi-header-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .bsi-brand-name {
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #EDEDEF;
  }
  .bsi-brand-url {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 11px;
    color: #6A6A72;
  }
  .bsi-brand-tagline {
    font-size: 12px;
    color: #8A8A92;
    font-style: italic;
    margin-top: 4px;
  }
  .bsi-header-actions {
    display: flex;
    gap: 8px;
    align-items: center;
    margin-left: auto;
  }
  .bsi-scraped-badge {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    color: #4A4A50;
    background: rgba(255,255,255,0.04);
    padding: 5px 10px;
    border-radius: 6px;
    letter-spacing: 0.04em;
  }
  .bsi-rescan-btn {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 9px;
    font-weight: 600;
    color: #E8833A;
    background: rgba(232,131,58,0.08);
    border: none;
    padding: 5px 10px;
    border-radius: 6px;
    cursor: pointer;
    transition: background 0.15s ease;
    letter-spacing: 0.04em;
  }
  .bsi-rescan-btn:hover:not(:disabled) {
    background: rgba(232,131,58,0.15);
  }
  .bsi-rescan-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  .bsi-rescan-icon {
    margin-right: 4px;
  }

  /* ── Labels ── */
  .bsi-label {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #4A4A50;
  }

  /* ── Color Palette ── */
  .bsi-palette-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .bsi-palette-grid {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  .bsi-swatch {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .bsi-swatch-block {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    border: 2px solid rgba(255,255,255,0.06);
    box-shadow: 0 2px 12px rgba(0,0,0,0.4);
    transition: transform 0.15s ease;
  }
  .bsi-swatch-block:hover {
    transform: scale(1.1);
  }
  .bsi-swatch-primary {
    border-color: rgba(232,131,58,0.4);
    box-shadow: 0 2px 12px rgba(232,131,58,0.2);
  }
  .bsi-swatch-name {
    font-size: 9px;
    color: #8A8A92;
    text-transform: capitalize;
  }
  .bsi-swatch-hex {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    color: #4A4A50;
    letter-spacing: 0.04em;
  }

  /* ── Typography ── */
  .bsi-typo-card {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .bsi-typo-specimens {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .bsi-typo-specimen {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 12px;
    background: rgba(255,255,255,0.02);
    border-radius: 8px;
  }
  .bsi-typo-font-name {
    font-size: 10px;
    color: #E8833A;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .bsi-typo-sample {
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    color: #EDEDEF;
  }
  .bsi-typo-sample-body {
    font-size: 13px;
    color: #8A8A92;
    line-height: 1.5;
  }
  .bsi-typo-weights {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
  .bsi-typo-weight-chip {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    color: #4A4A50;
    background: rgba(255,255,255,0.04);
    padding: 3px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .bsi-typo-source-chip {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    color: #E8833A;
    background: rgba(232,131,58,0.08);
    padding: 3px 8px;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  /* ── Logo System ── */
  .bsi-logo-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    align-items: center;
  }
  .bsi-logo-variants {
    display: flex;
    gap: 10px;
    width: 100%;
  }
  .bsi-logo-variant {
    flex: 1;
    aspect-ratio: 1;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .bsi-logo-variant img {
    max-width: 60%;
    max-height: 60%;
    object-fit: contain;
  }
  .bsi-logo-dark {
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.06);
  }
  .bsi-logo-light {
    background: #EDEDEF;
    border: 1px solid rgba(0,0,0,0.06);
  }
  .bsi-logo-initial-lg {
    font-size: 36px;
    font-weight: 700;
    color: #E8833A;
  }
  .bsi-logo-caption {
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    color: #4A4A50;
    letter-spacing: 0.08em;
    text-align: center;
  }

  /* ── Application Examples ── */
  .bsi-apps-card {
    grid-column: span 3;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .bsi-apps-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
  }
  .bsi-app-mock {
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(255,255,255,0.05);
    border-radius: 10px;
    overflow: hidden;
  }
  .bsi-app-mock-header {
    padding: 8px 12px;
    font-family: 'Geist Mono Variable', 'SF Mono', monospace;
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #4A4A50;
    border-bottom: 1px solid rgba(255,255,255,0.04);
  }
  .bsi-app-mock-body {
    padding: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 80px;
  }
  .bsi-app-mock-desc {
    font-size: 10px;
    color: #6A6A72;
    line-height: 1.5;
    text-align: center;
    max-width: 90%;
  }

  /* ── Skeleton loading ── */
  .bsi-skeleton-header {
    background: rgba(255,255,255,0.02);
  }
  .bsi-skel {
    background: rgba(255,255,255,0.04);
    border-radius: 8px;
    animation: bsi-shimmer 1.5s ease-in-out infinite;
  }
  .bsi-skel-logo { width: 72px; height: 72px; border-radius: 14px; flex-shrink: 0; }
  .bsi-skel-text-group { flex: 1; display: flex; flex-direction: column; gap: 8px; }
  .bsi-skel-title { height: 20px; width: 160px; }
  .bsi-skel-subtitle { height: 12px; width: 100px; }
  .bsi-skel-card { min-height: 160px; }
  .bsi-skel-label { height: 10px; width: 80px; }
  .bsi-skel-block { height: 48px; width: 100%; margin-top: 12px; }
  .bsi-skel-block-sm { height: 32px; width: 70%; margin-top: 8px; }

  @keyframes bsi-shimmer {
    0%, 100% { opacity: 0.4; }
    50% { opacity: 0.8; }
  }

  /* ── Responsive ── */
  @media (max-width: 900px) {
    .bsi-grid {
      grid-template-columns: 1fr;
    }
    .bsi-header, .bsi-apps-card {
      grid-column: span 1;
    }
    .bsi-apps-grid {
      grid-template-columns: 1fr 1fr;
    }
    .bsi-header {
      flex-direction: column;
      align-items: flex-start;
    }
    .bsi-header-actions {
      margin-left: 0;
    }
  }
</style>
```

- [ ] **Step 2: Verify component compiles**

Run: `npx svelte-check --threshold error 2>&1 | tail -10`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/brands/BrandSchemeSection.svelte
git commit -m "feat: add BrandSchemeSection component — 3-column identity grid"
```

---

### Task 6: Replace Row 6 in BrandOsDashboard with BrandSchemeSection

**Files:**
- Modify: `src/lib/components/brands/BrandOsDashboard.svelte:1-8, 364-446`

- [ ] **Step 1: Add import and prop for rescan handler**

In `src/lib/components/brands/BrandOsDashboard.svelte`, add the import after line 2:

```typescript
  import BrandSchemeSection from './BrandSchemeSection.svelte';
```

Add a new export prop after line 8 (`export let onRegenerateBrandKit`):

```typescript
  export let onScrapeIdentity: (url?: string) => void = () => {};
```

- [ ] **Step 2: Replace Row 6 markup**

Remove the entire Row 6 block — from the comment `<!-- ROW 6: Brand Direction (span 2) + Brand Style (span 1) -->` (line 364) through the closing `</div>` of the `bs-style-box` card and the regenerate button (line 446). Replace with:

```svelte
<!-- ROW 6: Brand Scheme & Identity -->
<BrandSchemeSection
  brandScheme={dashboard.brandScheme ?? null}
  brandName={dashboard.executive.brandName}
  {syncing}
  onRescan={onScrapeIdentity}
/>
```

- [ ] **Step 3: Remove now-unused CSS**

Remove the CSS blocks for the old Row 6 components that are no longer used:
- `.bs-direction` and related (`.bs-direction-desc`, `.bs-vibe-chips`, `.bs-vibe-chip`, `.bs-direction-insights`, `.bs-insight-pill`, `.bs-insight-pill-label`, `.bs-insight-pill-val`)
- `.bs-style-box` and related (`.bs-style-section`, `.bs-style-sublabel`, `.bs-style-row`, `.bs-style-val`, `.bs-palette-row`, `.bs-palette-dots`, `.bs-palette-dot`, `.bs-pillar-chips`, `.bs-pillar-chip`, `.bs-dodont-section`, `.bs-dodont-list`, `.bs-dodont-item`, `.bs-dodont-do`, `.bs-dodont-dont`, `.bs-regen-trigger`, `.bs-regen-icon`)

Check for any responsive overrides for `.bs-direction` and `.bs-style-box` in media queries and remove those too.

**Important:** Before removing CSS, grep the component for each class name to confirm they are only used in the old Row 6 markup and not elsewhere in the component.

- [ ] **Step 4: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | tail -15`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/brands/BrandOsDashboard.svelte
git commit -m "feat: replace Row 6 with BrandSchemeSection component"
```

---

### Task 7: Wire the rescan handler in the portal page

**Files:**
- Modify: `src/routes/brands/portal/+page.svelte`

The portal page mounts `BrandOsDashboard` and passes callbacks. We need to add the `onScrapeIdentity` handler that calls the new API endpoint and refreshes dashboard data.

- [ ] **Step 1: Find the BrandOsDashboard usage in portal page**

Search for where `<BrandOsDashboard` is rendered in `src/routes/brands/portal/+page.svelte`. It will have props like `dashboard={...}`, `syncing={...}`, `onRefresh={...}`, `onRegenerateBrandKit={...}`.

- [ ] **Step 2: Add the scrape identity handler function**

In the `<script>` section of the portal page, near the other handler functions (e.g., `onRegenerateBrandKit`), add:

```typescript
  async function handleScrapeIdentity(url?: string) {
    syncing = true;
    try {
      const body: Record<string, string> = {};
      if (url) body.websiteUrl = url;
      const res = await fetch('/api/brand/os-scrape-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        // Refresh dashboard to pick up the new brandScheme
        await refreshDashboard();
      } else {
        const data = await res.json().catch(() => ({}));
        console.error('[portal] Scrape identity failed:', data.error);
      }
    } catch (err) {
      console.error('[portal] Scrape identity error:', err);
    } finally {
      syncing = false;
    }
  }
```

Note: `refreshDashboard` is the existing function that re-fetches `/api/brand/os-dashboard` and updates the dashboard reactive variable. Find its actual name in the file — it might be called `loadDashboard`, `refreshData`, `onRefresh`, or similar. Use whatever name the codebase uses.

- [ ] **Step 3: Pass the handler to BrandOsDashboard**

On the `<BrandOsDashboard>` element, add the prop:

```svelte
  onScrapeIdentity={handleScrapeIdentity}
```

- [ ] **Step 4: Verify it compiles**

Run: `npx svelte-check --threshold error 2>&1 | tail -10`
Expected: No new errors.

- [ ] **Step 5: Commit**

```bash
git add src/routes/brands/portal/+page.svelte
git commit -m "feat: wire brand identity scraping to portal page"
```

---

### Task 8: Test end-to-end in the browser

**Files:** None — manual testing.

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: SvelteKit dev server starts without errors.

- [ ] **Step 2: Navigate to the Content Studio dashboard**

Open the app in a browser, log in as a brand account, and navigate to the Content Studio page. Verify:

1. If no `brandScheme` exists: Row 6 shows the empty state with URL input and "Scan Website" button
2. Enter a website URL and click "Scan Website"
3. Verify the scanning skeleton appears
4. After a few seconds, the full Brand Scheme section should render with:
   - Header row: logo, brand name, URL, tagline, "Scraped just now" badge, Rescan button
   - Color Palette card with named swatches
   - Typography card with font specimens
   - Logo System card with dark/light variants
   - Application Examples row with 4 mockup cards

- [ ] **Step 3: Test the Rescan button**

Click the "Rescan" button. Verify it re-scrapes and updates the data.

- [ ] **Step 4: Test responsive layout**

Resize the browser to < 900px width. Verify the grid collapses to single column and app examples go to 2-column.

- [ ] **Step 5: Commit any fixes from testing**

```bash
git add -A
git commit -m "fix: polish brand scheme section after browser testing"
```
