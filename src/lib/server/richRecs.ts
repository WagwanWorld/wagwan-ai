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

export async function searchMovie(title: string): Promise<MovieResult | null> {
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
    const coverUrl = vol.imageLinks?.thumbnail || vol.imageLinks?.smallThumbnail || '';
    if (!coverUrl) return null;
    // Upgrade to HTTPS
    const secureCover = coverUrl.replace(/^http:/, 'https:');
    return {
      title: vol.title || title,
      author: vol.authors?.[0] || author || '',
      coverUrl: secureCover,
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
