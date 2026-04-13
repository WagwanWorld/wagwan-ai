/**
 * Shared fetch helpers for chat-related APIs (consistent error surfaces).
 */

export type JsonFetchResult<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  data: T | null;
  raw: string;
};

export async function readJsonResponse<T = Record<string, unknown>>(res: Response): Promise<JsonFetchResult<T>> {
  const raw = await res.text();
  try {
    return { ok: res.ok, status: res.status, data: JSON.parse(raw) as T, raw };
  } catch {
    return { ok: res.ok, status: res.status, data: null, raw };
  }
}

export function errorMessageFromJson(
  data: Record<string, unknown> | null,
  fallback: string,
): string {
  if (!data) return fallback;
  const err = data.error ?? data.message;
  return typeof err === 'string' ? err : fallback;
}
