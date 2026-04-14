/**
 * POST /api/brand/enrich
 *
 * Scrapes a brand's website and Instagram profile to extract context.
 * Returns enriched brand info for the matching agent.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface EnrichResult {
  website: {
    title: string;
    description: string;
    ogDescription: string;
    textSnippet: string;
  } | null;
  instagram: {
    bio: string;
    followers: string;
    following: string;
    posts: string;
    fullName: string;
    isVerified: boolean;
  } | null;
}

async function scrapeWebsite(url: string): Promise<EnrichResult['website']> {
  try {
    // Normalize URL
    let fetchUrl = url.trim();
    if (!fetchUrl.startsWith('http')) fetchUrl = 'https://' + fetchUrl;

    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Wagwan/1.0; +https://wagwan.ai)',
        'Accept': 'text/html',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Extract title
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? '';

    // Extract meta description
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const description = descMatch?.[1]?.trim() ?? '';

    // Extract OG description
    const ogMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
    const ogDescription = ogMatch?.[1]?.trim() ?? '';

    // Extract visible text snippet (strip tags, take first 500 chars)
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyHtml = bodyMatch?.[1] ?? '';
    const textSnippet = bodyHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);

    return { title, description, ogDescription, textSnippet };
  } catch (e) {
    console.error('[brand/enrich] Website scrape failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

async function scrapeInstagram(handle: string): Promise<EnrichResult['instagram']> {
  try {
    const username = handle.replace(/^@/, '').trim();
    if (!username) return null;

    // Fetch the public Instagram profile page
    const res = await fetch(`https://www.instagram.com/${username}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    // Try to extract from meta tags (most reliable for public profiles)
    const ogDescMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i)
      || html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
    const ogDesc = ogDescMatch?.[1] ?? '';

    // Parse OG description format: "X Followers, Y Following, Z Posts - See Instagram photos and videos from Name (@handle)"
    const statsMatch = ogDesc.match(/([\d,.]+[KMk]?)\s*Followers?,?\s*([\d,.]+[KMk]?)\s*Following,?\s*([\d,.]+[KMk]?)\s*Posts?/i);

    const titleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i);
    const ogTitle = titleMatch?.[1] ?? '';
    // OG title format: "Name (@handle) • Instagram photos and videos"
    const nameMatch = ogTitle.match(/^(.+?)\s*\(@/);
    const fullName = nameMatch?.[1]?.trim() ?? username;

    // Try to get bio from description meta
    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
    const descContent = descMatch?.[1] ?? '';
    // Bio is usually after the stats in the description
    const bioMatch = descContent.match(/Posts?\s*[-–—]\s*(.*)/i);
    const bio = bioMatch?.[1]?.replace(/See Instagram.*$/i, '').trim() ?? '';

    const isVerified = html.includes('"is_verified":true') || html.includes('verified_badge');

    return {
      bio,
      followers: statsMatch?.[1] ?? '',
      following: statsMatch?.[2] ?? '',
      posts: statsMatch?.[3] ?? '',
      fullName,
      isVerified,
    };
  } catch (e) {
    console.error('[brand/enrich] Instagram scrape failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

export const POST: RequestHandler = async ({ request }) => {
  let body: { website?: string; instagram?: string };
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid_json' }, { status: 400 });
  }

  const [website, instagram] = await Promise.all([
    body.website?.trim() ? scrapeWebsite(body.website) : Promise.resolve(null),
    body.instagram?.trim() ? scrapeInstagram(body.instagram) : Promise.resolve(null),
  ]);

  // Build a human-readable context string
  const contextParts: string[] = [];

  if (website) {
    if (website.title) contextParts.push(`Website title: ${website.title}`);
    if (website.description) contextParts.push(`Website description: ${website.description}`);
    else if (website.ogDescription) contextParts.push(`Website description: ${website.ogDescription}`);
    if (website.textSnippet) contextParts.push(`Website content preview: ${website.textSnippet.slice(0, 300)}`);
  }

  if (instagram) {
    if (instagram.fullName) contextParts.push(`Instagram name: ${instagram.fullName}`);
    if (instagram.bio) contextParts.push(`Instagram bio: ${instagram.bio}`);
    if (instagram.followers) contextParts.push(`Instagram followers: ${instagram.followers}`);
    if (instagram.posts) contextParts.push(`Instagram posts: ${instagram.posts}`);
  }

  return json({
    ok: true,
    website,
    instagram,
    contextSummary: contextParts.join('\n') || '',
  });
};
