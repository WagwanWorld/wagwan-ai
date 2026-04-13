import { env } from '$env/dynamic/private';

const OPENAI_EMBED_MODEL = 'text-embedding-3-small';

/**
 * Batch embeddings via OpenAI. Returns null if no API key or request fails.
 */
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const key = (env.OPENAI_API_KEY ?? env.IDENTITY_EMBEDDINGS_OPENAI_KEY ?? '').trim();
  if (!key || texts.length === 0) return null;

  const cleaned = texts.map(t => t.replace(/\s+/g, ' ').trim().slice(0, 8000)).filter(Boolean);
  if (!cleaned.length) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_EMBED_MODEL,
        input: cleaned,
      }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.error('[identityClaims/embeddings] OpenAI error:', res.status, err.slice(0, 200));
      return null;
    }
    const data = (await res.json()) as {
      data?: Array<{ embedding: number[]; index: number }>;
    };
    const rows = data.data ?? [];
    rows.sort((a, b) => a.index - b.index);
    return rows.map(r => r.embedding);
  } catch (e) {
    console.error('[identityClaims/embeddings]', e);
    return null;
  }
}

export function embeddingToPgVectorLiteral(vec: number[]): string {
  return `[${vec.join(',')}]`;
}
