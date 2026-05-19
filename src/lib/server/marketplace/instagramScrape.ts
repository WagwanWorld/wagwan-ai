export interface ScrapedInstagramProfile {
  bio: string;
  followers: string;
  following: string;
  posts: string;
  fullName: string;
  isVerified: boolean;
  profilePictureUrl?: string;
  recentCaptions: string[];
}

function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractOgImage(html: string): string | undefined {
  const match =
    html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']*)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:image["']/i);
  const url = match?.[1]?.trim();
  if (!url || url.includes('rsrc.php')) return undefined;
  return decodeHtmlEntities(url);
}

function extractRecentCaptions(html: string, max = 6): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  const push = (raw: string) => {
    const text = decodeHtmlEntities(raw)
      .replace(/\\n/g, ' ')
      .replace(/\\u([\dA-Fa-f]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length < 8 || text.length > 500) return;
    const key = text.slice(0, 80);
    if (seen.has(key)) return;
    seen.add(key);
    out.push(text);
  };

  const patterns = [
    /"caption"\s*:\s*"((?:\\.|[^"\\])*)"/g,
    /edge_media_to_caption[^}]*"text"\s*:\s*"((?:\\.|[^"\\])*)"/g,
  ];

  for (const re of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null && out.length < max) {
      push(m[1]);
    }
  }

  return out.slice(0, max);
}

export async function scrapeInstagram(handle: string): Promise<ScrapedInstagramProfile | null> {
  try {
    const username = handle.replace(/^@/, '').trim();
    if (!username) return null;

    const res = await fetch(`https://www.instagram.com/${encodeURIComponent(username)}/`, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
        Accept: 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const html = await res.text();

    const ogDescMatch =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:description["']/i);
    const ogDesc = ogDescMatch?.[1] ?? '';

    const statsMatch = ogDesc.match(
      /([\d,.]+[KMk]?)\s*Followers?,?\s*([\d,.]+[KMk]?)\s*Following,?\s*([\d,.]+[KMk]?)\s*Posts?/i,
    );

    const titleMatch =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']*)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']*)["'][^>]*property=["']og:title["']/i);
    const ogTitle = titleMatch?.[1] ?? '';
    const nameMatch = ogTitle.match(/^(.+?)\s*\(@/);
    const fullName = nameMatch?.[1]?.trim() ?? username;

    const descMatch = html.match(
      /<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i,
    );
    const descContent = descMatch?.[1] ?? '';
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
      profilePictureUrl: extractOgImage(html),
      recentCaptions: extractRecentCaptions(html),
    };
  } catch (e) {
    console.error('[instagramScrape] failed:', e instanceof Error ? e.message : e);
    return null;
  }
}
