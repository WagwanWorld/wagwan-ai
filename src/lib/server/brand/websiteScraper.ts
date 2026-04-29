/**
 * websiteScraper.ts
 *
 * Fetches a brand website and extracts raw identity signals:
 * colors, fonts, logos, favicon, tagline, title, og:image.
 *
 * Pure extraction — no LLM calls, no database access.
 */

// ─── Exported Types ──────────────────────────────────────────────────────────

export interface RawBrandSignals {
  colors: { hex: string; frequency: number }[];
  fonts: { family: string; source: 'google' | 'adobe' | 'system' | 'custom' }[];
  logoUrls: string[];
  faviconUrl: string | null;
  tagline: string | null;
  title: string | null;
  ogImage: string | null;
}

// ─── Internal Helpers ────────────────────────────────────────────────────────

/** Normalize relative / protocol-relative URLs against a base. */
function resolveUrl(href: string, base: string): string {
  try {
    return new URL(href, base).href;
  } catch {
    return '';
  }
}

/** Expand 3-digit hex shorthand (#abc → #aabbcc). */
function expandHex(hex: string): string {
  if (hex.length === 4) {
    // #rgb → #rrggbb
    return '#' + hex[1] + hex[1] + hex[2] + hex[2] + hex[3] + hex[3];
  }
  return hex.toLowerCase();
}

/** Parse r,g,b integers from "r, g, b" or "r g b" string. */
function parseRgbTriplet(str: string): [number, number, number] | null {
  const parts = str.split(/[\s,]+/).map(Number);
  if (parts.length >= 3 && parts.every(n => !isNaN(n))) {
    return [
      Math.round(Math.min(255, Math.max(0, parts[0]))),
      Math.round(Math.min(255, Math.max(0, parts[1]))),
      Math.round(Math.min(255, Math.max(0, parts[2]))),
    ];
  }
  return null;
}

/** Convert rgb integers to #rrggbb hex string. */
function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

/** Euclidean RGB distance. */
function colorDistance(a: string, b: string): number {
  const ar = parseInt(a.slice(1, 3), 16);
  const ag = parseInt(a.slice(3, 5), 16);
  const ab = parseInt(a.slice(5, 7), 16);
  const br = parseInt(b.slice(1, 3), 16);
  const bg = parseInt(b.slice(3, 5), 16);
  const bb = parseInt(b.slice(5, 7), 16);
  return Math.sqrt((ar - br) ** 2 + (ag - bg) ** 2 + (ab - bb) ** 2);
}

/**
 * Parse hex (#abc, #aabbcc) and rgb/rgba values from CSS text.
 * Deduplicates colors within ~30 units RGB distance, returns top 20 by frequency.
 */
export function extractColors(css: string): { hex: string; frequency: number }[] {
  const counts = new Map<string, number>();

  // Match hex colors
  const hexPattern = /#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b/g;
  let m: RegExpExecArray | null;
  while ((m = hexPattern.exec(css)) !== null) {
    const hex = expandHex(m[0]);
    counts.set(hex, (counts.get(hex) ?? 0) + 1);
  }

  // Match rgb() and rgba()
  const rgbPattern = /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/g;
  while ((m = rgbPattern.exec(css)) !== null) {
    const triplet = parseRgbTriplet(`${m[1]},${m[2]},${m[3]}`);
    if (triplet) {
      const hex = rgbToHex(...triplet);
      counts.set(hex, (counts.get(hex) ?? 0) + 1);
    }
  }

  // Sort by frequency descending
  const sorted = [...counts.entries()]
    .map(([hex, frequency]) => ({ hex, frequency }))
    .sort((a, b) => b.frequency - a.frequency);

  // Deduplicate similar colors (keep the more frequent representative)
  const DISTANCE_THRESHOLD = 30;
  const deduped: { hex: string; frequency: number }[] = [];

  for (const candidate of sorted) {
    const isTooClose = deduped.some(
      existing => colorDistance(candidate.hex, existing.hex) < DISTANCE_THRESHOLD,
    );
    if (!isTooClose) {
      deduped.push(candidate);
    }
    if (deduped.length >= 20) break;
  }

  return deduped;
}

const SYSTEM_FONTS = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'emoji',
  'math',
  'fangsong',
  'arial',
  'helvetica',
  'helvetica neue',
  'verdana',
  'tahoma',
  'trebuchet ms',
  'times new roman',
  'times',
  'georgia',
  'garamond',
  'courier new',
  'courier',
  'lucida console',
  'impact',
  'comic sans ms',
  'palatino',
  'geneva',
  'optima',
  'segoe ui',
  'roboto',
  '-apple-system',
  'blinkmacsystemfont',
]);

/**
 * Parse font families from CSS and HTML, classify by source (google/adobe/system/custom).
 * Returns up to 10 non-system fonts.
 */
export function extractFonts(
  css: string,
  html: string,
): { family: string; source: 'google' | 'adobe' | 'system' | 'custom' }[] {
  const seenFamilies = new Map<string, 'google' | 'adobe' | 'system' | 'custom'>();

  // Detect Google Fonts families from link tags
  const googleFontLinks = [...html.matchAll(/fonts\.googleapis\.com\/css[^"']*family=([^"'&]+)/gi)];
  for (const linkMatch of googleFontLinks) {
    const rawFamilies = decodeURIComponent(linkMatch[1]);
    // format: "Roboto:wght@400|Open+Sans"
    const families = rawFamilies.split('|').map(f => f.split(':')[0].replace(/\+/g, ' ').trim());
    for (const fam of families) {
      if (fam) seenFamilies.set(fam.toLowerCase(), 'google');
    }
  }

  // Detect Adobe Fonts (Typekit) from link/script tags
  const hasAdobe = /use\.typekit\.net/i.test(html);

  // Parse font-family declarations from CSS
  const fontFamilyPattern = /font-family\s*:\s*([^;}{]+)/gi;
  let m: RegExpExecArray | null;
  while ((m = fontFamilyPattern.exec(css)) !== null) {
    const value = m[1].trim();
    // Split by comma, strip quotes, take each token
    const tokens = value.split(',').map(t => t.replace(/["']/g, '').trim());
    for (const token of tokens) {
      if (!token) continue;
      const lower = token.toLowerCase();
      if (seenFamilies.has(lower)) continue; // already classified

      if (SYSTEM_FONTS.has(lower)) {
        seenFamilies.set(lower, 'system');
      } else if (hasAdobe) {
        seenFamilies.set(lower, 'adobe');
      } else {
        seenFamilies.set(lower, 'custom');
      }
    }
  }

  // Build result — non-system fonts first, up to 10
  const result: { family: string; source: 'google' | 'adobe' | 'system' | 'custom' }[] = [];

  for (const [lower, source] of seenFamilies) {
    if (source === 'system') continue;
    // Reconstruct display name (title-case first char)
    const family = lower.replace(/\b\w/g, c => c.toUpperCase());
    result.push({ family, source });
    if (result.length >= 10) break;
  }

  return result;
}

/**
 * Extract logo/favicon URLs from HTML.
 * Returns up to 5 unique logo URLs and the best favicon URL.
 */
export function extractLogos(
  html: string,
  baseUrl: string,
): { logoUrls: string[]; faviconUrl: string | null } {
  const logoSet = new Set<string>();
  let faviconUrl: string | null = null;

  // Favicon: <link rel="icon"> or <link rel="shortcut icon">
  const faviconMatch = html.match(
    /<link[^>]*rel=["'][^"']*\bicon\b[^"']*["'][^>]*href=["']([^"']+)["']/i,
  ) ?? html.match(
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*\bicon\b[^"']*["']/i,
  );
  if (faviconMatch?.[1]) {
    const resolved = resolveUrl(faviconMatch[1], baseUrl);
    if (resolved) faviconUrl = resolved;
  }

  // Apple touch icon (also a good logo proxy)
  const appleIconMatch = html.match(
    /<link[^>]*rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*href=["']([^"']+)["']/i,
  ) ?? html.match(
    /<link[^>]*href=["']([^"']+)["'][^>]*rel=["'][^"']*apple-touch-icon[^"']*["']/i,
  );
  if (appleIconMatch?.[1]) {
    const resolved = resolveUrl(appleIconMatch[1], baseUrl);
    if (resolved) logoSet.add(resolved);
  }

  // og:image
  const ogImageMatch = html.match(
    /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i,
  ) ?? html.match(
    /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i,
  );
  if (ogImageMatch?.[1]) {
    const resolved = resolveUrl(ogImageMatch[1], baseUrl);
    if (resolved) logoSet.add(resolved);
  }

  // <img> tags with "logo" in src, alt, class, or id
  const imgPattern = /<img[^>]+>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgPattern.exec(html)) !== null) {
    const tag = imgMatch[0];
    const isLogoImg =
      /(?:src|alt|class|id)=["'][^"']*logo[^"']*["']/i.test(tag) ||
      /logo/i.test(tag);
    if (!isLogoImg) continue;

    const srcMatch = tag.match(/src=["']([^"']+)["']/i);
    if (srcMatch?.[1]) {
      const resolved = resolveUrl(srcMatch[1], baseUrl);
      if (resolved) logoSet.add(resolved);
    }
    if (logoSet.size >= 5) break;
  }

  return {
    logoUrls: [...logoSet].slice(0, 5),
    faviconUrl,
  };
}

/**
 * Extract a short tagline from HTML.
 * Priority: og:description → meta description → first h1 (<200 chars)
 */
export function extractTagline(html: string): string | null {
  // og:description
  const ogDesc =
    html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i)?.[1];
  if (ogDesc?.trim()) return ogDesc.trim();

  // meta description
  const metaDesc =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i)?.[1];
  if (metaDesc?.trim()) return metaDesc.trim();

  // First h1
  const h1Match = html.match(/<h1[^>]*>([^<]{1,200})<\/h1>/i);
  const h1Text = h1Match?.[1]?.replace(/\s+/g, ' ').trim() ?? null;
  if (h1Text && h1Text.length < 200) return h1Text;

  return null;
}

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Scrape a website URL and extract raw brand identity signals.
 * No LLM calls — returns structured data for downstream refinement.
 */
export async function scrapeWebsiteIdentity(url: string): Promise<RawBrandSignals> {
  // 1. Normalize URL
  let fetchUrl = url.trim();
  if (!fetchUrl.startsWith('http')) fetchUrl = 'https://' + fetchUrl;

  // 2. Fetch the HTML page
  const res = await fetch(fetchUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; Wagwan/1.0; +https://wagwan.ai)',
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch ${fetchUrl}: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const baseUrl = fetchUrl;

  // 3. Collect CSS: <style> blocks + inline style attributes
  const styleBlocks: string[] = [];

  const styleTagPattern = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let sm: RegExpExecArray | null;
  while ((sm = styleTagPattern.exec(html)) !== null) {
    styleBlocks.push(sm[1]);
  }

  const inlineStylePattern = /style=["']([^"']+)["']/gi;
  while ((sm = inlineStylePattern.exec(html)) !== null) {
    styleBlocks.push(sm[1]);
  }

  // 4. Fetch up to 3 linked external stylesheets (5s each)
  const linkHrefPattern = /<link[^>]*rel=["'][^"']*stylesheet[^"']*["'][^>]*href=["']([^"']+)["']/gi;
  const sheetUrls: string[] = [];
  while ((sm = linkHrefPattern.exec(html)) !== null && sheetUrls.length < 3) {
    const resolved = resolveUrl(sm[1], baseUrl);
    if (resolved) sheetUrls.push(resolved);
  }

  const sheetResults = await Promise.allSettled(
    sheetUrls.map(sheetUrl =>
      fetch(sheetUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Wagwan/1.0; +https://wagwan.ai)' },
        signal: AbortSignal.timeout(5_000),
      }).then(r => (r.ok ? r.text() : '')),
    ),
  );

  for (const result of sheetResults) {
    if (result.status === 'fulfilled' && result.value) {
      styleBlocks.push(result.value);
    }
  }

  const allCss = styleBlocks.join('\n');

  // 5. Extract individual signals
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch?.[1]?.trim() ?? null;

  const ogImageMatch =
    html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  const ogImage = ogImageMatch?.[1]
    ? resolveUrl(ogImageMatch[1], baseUrl) || null
    : null;

  const colors = extractColors(allCss);
  const fonts = extractFonts(allCss, html);
  const { logoUrls, faviconUrl } = extractLogos(html, baseUrl);
  const tagline = extractTagline(html);

  // 6. Return
  return {
    colors,
    fonts,
    logoUrls,
    faviconUrl,
    tagline,
    title,
    ogImage,
  };
}
