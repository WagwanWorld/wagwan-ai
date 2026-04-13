/**
 * Resolve a brand-ish logo URL from free-text shopping lines.
 * Uses a curated name→domain map, then Google’s favicon service (reliable in <img>, no CORS issues).
 */

/** Longer phrases first — match more specific names before short tokens */
const CURATED_BRAND_DOMAINS: Array<[string, string]> = [
  ['warby parker', 'warbyparker.com'],
  ['lululemon', 'shop.lululemon.com'],
  ['uniqlo', 'uniqlo.com'],
  ['everlane', 'everlane.com'],
  ['patagonia', 'patagonia.com'],
  ['nike', 'nike.com'],
  ['adidas', 'adidas.com'],
  ['apple', 'apple.com'],
  ['samsung', 'samsung.com'],
  ['sony', 'sony.com'],
  ['bose', 'bose.com'],
  ['ikea', 'ikea.com'],
  ['target', 'target.com'],
  ['walmart', 'walmart.com'],
  ['costco', 'costco.com'],
  ['amazon', 'amazon.com'],
  ['etsy', 'etsy.com'],
  ['shopify', 'shopify.com'],
  ['stripe', 'stripe.com'],
  ['notion', 'notion.so'],
  ['figma', 'figma.com'],
  ['slack', 'slack.com'],
  ['zoom', 'zoom.us'],
  ['spotify', 'spotify.com'],
  ['netflix', 'netflix.com'],
  ['hulu', 'hulu.com'],
  ['disney', 'disney.com'],
  ['starbucks', 'starbucks.com'],
  ['chipotle', 'chipotle.com'],
  ['sweetgreen', 'sweetgreen.com'],
  ['allbirds', 'allbirds.com'],
  ['reformation', 'thereformation.com'],
  ['zara', 'zara.com'],
  ['h&m', 'hm.com'],
  ['cos', 'cos.com'],
  ['aritzia', 'aritzia.com'],
  ['anthropologie', 'anthropologie.com'],
  ['sephora', 'sephora.com'],
  ['ulta', 'ulta.com'],
  ['glossier', 'glossier.com'],
  ['le labo', 'lelabofragrances.com'],
  ['aesop', 'aesop.com'],
  ['hermes', 'hermes.com'],
  ['gucci', 'gucci.com'],
  ['prada', 'prada.com'],
  ['cartier', 'cartier.com'],
  ['rolex', 'rolex.com'],
  ['tesla', 'tesla.com'],
  ['bmw', 'bmw.com'],
  ['mercedes', 'mercedes-benz.com'],
  ['audi', 'audi.com'],
  ['porsche', 'porsche.com'],
  ['subaru', 'subaru.com'],
  ['honda', 'honda.com'],
  ['toyota', 'toyota.com'],
  ['wayfair', 'wayfair.com'],
  ['west elm', 'westelm.com'],
  ['crate and barrel', 'crateandbarrel.com'],
  ['cb2', 'cb2.com'],
  ['herman miller', 'hermanmiller.com'],
  ['steelcase', 'steelcase.com'],
  ['dyson', 'dyson.com'],
  ['muji', 'muji.com'],
  ['canada goose', 'canadagoose.com'],
  ['north face', 'thenorthface.com'],
  ['arcteryx', 'arcteryx.com'],
  ['carhartt', 'carhartt.com'],
  ['levi', 'levi.com'],
  ['levis', 'levi.com'],
  ['j.crew', 'jcrew.com'],
  ['banana republic', 'bananarepublic.gap.com'],
  ['gap', 'gap.com'],
  ['old navy', 'oldnavy.gap.com'],
  ['madewell', 'madewell.com'],
  ['brooklinen', 'brooklinen.com'],
  ['parachute', 'parachutehome.com'],
  ['oura', 'ouraring.com'],
  ['whoop', 'whoop.com'],
  ['peloton', 'onepeloton.com'],
];

function normalizeForMatch(s: string): string {
  return s.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Best-effort domain string for a shopping line (curated substring match).
 */
export function findBrandDomainInText(text: string): string | null {
  const n = normalizeForMatch(text);
  if (!n) return null;

  const sorted = [...CURATED_BRAND_DOMAINS].sort((a, b) => b[0].length - a[0].length);
  for (const [name, domain] of sorted) {
    if (n.includes(name)) return domain;
  }

  // Single TitleCase token at start: "Nike runners" → try nike.com (weak)
  const m = text.trim().match(/^([A-Z][a-z0-9]+)\b/);
  if (m) {
    const guess = `${m[1].toLowerCase()}.com`;
    if (guess.length > 5) return guess;
  }

  return null;
}

/**
 * Google favicon — works as <img src> without a proxy.
 */
export function faviconUrlForDomain(domain: string, sz = 128): string {
  const d = domain.replace(/^https?:\/\//, '').split('/')[0] ?? domain;
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=${sz}`;
}

/**
 * Clearbit-style logo URL (may 404 for some domains; use with on:error fallback in UI).
 */
export function clearbitStyleLogoUrl(domain: string): string {
  const d = domain.replace(/^https?:\/\//, '').split('/')[0] ?? domain;
  return `https://logo.clearbit.com/${encodeURIComponent(d)}`;
}

/**
 * Prefer favicon for reliability; callers can try clearbit first if they handle errors.
 */
export function brandMarkUrlFromText(text: string): string | null {
  const domain = findBrandDomainInText(text);
  if (!domain) return null;
  return faviconUrlForDomain(domain);
}
