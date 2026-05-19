export type BriefAssetMediaType = 'image' | 'video';

export type BriefAssetInput = {
  url: string;
  gcsPath: string;
  mediaType: BriefAssetMediaType;
  thumbUrl?: string | null;
  caption?: string | null;
  sortOrder?: number | null;
  metadata?: Record<string, unknown> | null;
};

export type BriefAssetRow = {
  id: string;
  campaign_id: string;
  media_type: BriefAssetMediaType;
  url: string;
  gcs_path: string;
  thumb_url: string | null;
  caption: string | null;
  sort_order: number;
  created_at: string;
};

const MAX_ASSETS = 10;

function toMediaType(value: unknown): BriefAssetMediaType | null {
  if (value === 'image' || value === 'video') return value;
  if (value === 'IMAGE') return 'image';
  if (value === 'VIDEO') return 'video';
  return null;
}

export function normalizeBriefAssets(input: unknown): BriefAssetInput[] {
  if (!Array.isArray(input)) return [];
  const cleaned: BriefAssetInput[] = [];

  for (const [idx, raw] of input.entries()) {
    if (!raw || typeof raw !== 'object') continue;
    const item = raw as Record<string, unknown>;
    const url = typeof item.url === 'string' ? item.url.trim() : '';
    const gcsPath =
      typeof item.gcsPath === 'string'
        ? item.gcsPath.trim()
        : typeof item.gcs_path === 'string'
          ? item.gcs_path.trim()
          : '';
    const mediaType = toMediaType(item.mediaType ?? item.media_type);
    if (!url || !gcsPath || !mediaType) continue;
    cleaned.push({
      url,
      gcsPath,
      mediaType,
      thumbUrl: typeof item.thumbUrl === 'string' ? item.thumbUrl : null,
      caption: typeof item.caption === 'string' ? item.caption.slice(0, 280).trim() : null,
      sortOrder: Number.isFinite(Number(item.sortOrder)) ? Number(item.sortOrder) : idx,
      metadata:
        item.metadata && typeof item.metadata === 'object'
          ? (item.metadata as Record<string, unknown>)
          : null,
    });
    if (cleaned.length >= MAX_ASSETS) break;
  }
  return cleaned;
}
