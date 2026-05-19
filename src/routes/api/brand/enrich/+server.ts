/**
 * POST /api/brand/enrich
 *
 * Scrapes a brand's website and Instagram profile to extract context.
 * Returns enriched brand info for the matching agent.
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { scrapeInstagram } from '$lib/server/marketplace/instagramScrape';

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
    let fetchUrl = url.trim();
    if (!fetchUrl.startsWith('http')) fetchUrl = 'https://' + fetchUrl;

    const res = await fetch(fetchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Wagwan/1.0; +https://wagwan.ai)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
    const title = titleMatch?.[1]?.trim() ?? '';

    const descMatch =
      html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*name=["']description["']/i);
    const description = descMatch?.[1]?.trim() ?? '';

    const ogMatch =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
    const ogDescription = ogMatch?.[1]?.trim() ?? '';

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

  const contextParts: string[] = [];

  if (website) {
    if (website.title) contextParts.push(`Website title: ${website.title}`);
    if (website.description) contextParts.push(`Website description: ${website.description}`);
    else if (website.ogDescription)
      contextParts.push(`Website description: ${website.ogDescription}`);
    if (website.textSnippet)
      contextParts.push(`Website content preview: ${website.textSnippet.slice(0, 300)}`);
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
