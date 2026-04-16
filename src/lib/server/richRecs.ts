/**
 * External API helpers for rich recommendation images.
 * - TMDB: movie/show posters
 * - Google Books: book covers
 */

import { env } from '$env/dynamic/private';

// ── TMDB (Movies/Shows) ──

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_IMG = 'https://image.tmdb.org/t/p';

export interface MovieResult {
  title: string;
  posterUrl: string;
  overview: string;
  year: string;
  rating: number;
}

async function searchMovieTmdb(title: string): Promise<MovieResult | null> {
  const key = env.TMDB_API_KEY?.trim();
  if (!key) return null;
  try {
    const res = await fetch(
      `${TMDB_BASE}/search/movie?query=${encodeURIComponent(title)}&api_key=${key}&language=en-US&page=1`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const movie = data.results?.[0];
    if (!movie?.poster_path) return null;
    return {
      title: movie.title || title,
      posterUrl: `${TMDB_IMG}/w300${movie.poster_path}`,
      overview: (movie.overview || '').slice(0, 150),
      year: (movie.release_date || '').slice(0, 4),
      rating: movie.vote_average ?? 0,
    };
  } catch {
    return null;
  }
}

async function searchMovieWikipedia(title: string): Promise<MovieResult | null> {
  try {
    const slug = title.replace(/\s+/g, '_').replace(/[^\w_()'-]/g, '');
    // Try "Title (film)", then "Title (TV series)", then plain title
    for (const query of [`${slug}_(film)`, `${slug}_(TV_series)`, slug]) {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
        { signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const thumb = data.thumbnail?.source || data.originalimage?.source;
      if (!thumb) continue;
      // Upscale Wikipedia thumbnail to ~300px wide
      const posterUrl = thumb.replace(/\/\d+px-/, '/300px-');
      return {
        title: data.title || title,
        posterUrl,
        overview: (data.extract || '').slice(0, 150),
        year: '',
        rating: 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function searchMovie(title: string): Promise<MovieResult | null> {
  // Try TMDB first (better data), fall back to Wikipedia (free, no key)
  return await searchMovieTmdb(title) ?? await searchMovieWikipedia(title);
}

export async function searchMovies(titles: string[]): Promise<Record<string, MovieResult>> {
  const results: Record<string, MovieResult> = {};
  await Promise.all(
    titles.map(async (t) => {
      const movie = await searchMovie(t);
      if (movie) results[t] = movie;
    })
  );
  return results;
}

// ── Google Books ──

export interface BookResult {
  title: string;
  author: string;
  coverUrl: string;
  description: string;
  buyUrl: string;
}

async function searchBookOpenLibrary(title: string, author?: string): Promise<string> {
  try {
    const q = author ? `${title} ${author}` : title;
    const res = await fetch(
      `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return '';
    const data = await res.json();
    const coverId = data.docs?.[0]?.cover_i;
    return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg` : '';
  } catch {
    return '';
  }
}

export async function searchBook(title: string, author?: string): Promise<BookResult | null> {
  try {
    const q = author ? `${title} ${author}` : title;
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`,
      { signal: AbortSignal.timeout(6000) }
    );
    if (!res.ok) return null;
    const data = await res.json();
    const vol = data.items?.[0]?.volumeInfo;
    if (!vol) return null;
    let coverUrl = vol.imageLinks?.thumbnail || vol.imageLinks?.smallThumbnail || '';
    if (coverUrl) coverUrl = coverUrl.replace(/^http:/, 'https:');
    // Fall back to Open Library if Google Books has no cover
    if (!coverUrl) coverUrl = await searchBookOpenLibrary(title, author);
    return {
      title: vol.title || title,
      author: vol.authors?.[0] || author || '',
      coverUrl,
      description: (vol.description || '').slice(0, 120),
      buyUrl: `https://www.amazon.in/s?k=${encodeURIComponent(`${vol.title} ${vol.authors?.[0] || ''}`)}`,
    };
  } catch {
    return null;
  }
}

export async function searchBooks(items: { title: string; author?: string }[]): Promise<Record<string, BookResult>> {
  const results: Record<string, BookResult> = {};
  await Promise.all(
    items.map(async (item) => {
      const book = await searchBook(item.title, item.author);
      if (book) results[item.title] = book;
    })
  );
  return results;
}
