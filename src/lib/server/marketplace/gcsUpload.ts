import { Storage } from '@google-cloud/storage';
import { env } from '$env/dynamic/private';

function getStorage(): Storage {
  const raw = env.GCS_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error('GCS_SERVICE_ACCOUNT_KEY not configured');

  // Vercel may store JSON with real newlines inside the private_key field.
  // Parse with a two-pass approach: try direct parse, then fix newlines.
  let credentials: Record<string, unknown>;
  try {
    credentials = JSON.parse(raw);
  } catch {
    // Replace real newlines with escaped \\n only inside the private_key value
    const fixed = raw.replace(
      /"private_key"\s*:\s*"([\s\S]*?)(?<!\\)"/,
      (_, keyVal: string) => `"private_key":"${keyVal.replace(/\r?\n/g, '\\n')}"`
    );
    credentials = JSON.parse(fixed);
  }

  return new Storage({ credentials, projectId: credentials.project_id as string });
}

const BUCKET_NAME = 'wagwan-ai';
const MAX_IMAGE_SIZE = 8 * 1024 * 1024;   // 8MB
const MAX_VIDEO_SIZE = 100 * 1024 * 1024;  // 100MB
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/quicktime'];
const ALLOWED_FONT_TYPES = ['font/woff2', 'font/ttf', 'font/otf', 'application/font-woff2', 'application/x-font-ttf', 'application/vnd.ms-opentype'];

export interface UploadResult {
  url: string;
  gcsPath: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'FONT' | 'SVG';
  size: number;
}

// Extension → canonical MIME type (used as fallback when browser sends application/octet-stream)
const EXT_MIME_MAP: Record<string, string> = {
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
  otf: 'font/otf',
};

export async function uploadCreativeToGCS(
  file: File,
  brandIgId: string,
): Promise<UploadResult> {
  // Some OS file pickers (especially on macOS) send application/octet-stream for SVG/font files.
  // Resolve the actual MIME type from the file extension before validation.
  const fileExt = file.name.split('.').pop()?.toLowerCase() ?? '';
  const resolvedType =
    (file.type && file.type !== 'application/octet-stream')
      ? file.type
      : (EXT_MIME_MAP[fileExt] ?? file.type);

  // Work with the resolved type for validation and storage
  const effectiveFile = resolvedType !== file.type
    ? new File([file], file.name, { type: resolvedType })
    : file;

  const isSvg = effectiveFile.type === 'image/svg+xml';
  const isImage = ALLOWED_IMAGE_TYPES.includes(effectiveFile.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(effectiveFile.type);
  const isFont = ALLOWED_FONT_TYPES.includes(effectiveFile.type);
  if (!isImage && !isVideo && !isFont) {
    throw new Error(`Unsupported file type: ${file.type}${fileExt ? ` (.${fileExt})` : ''}. Supported: JPEG, PNG, WebP, SVG, MP4, or font files (WOFF2, TTF, OTF).`);
  }

  // Reassign file to the effective (type-corrected) version
  // eslint-disable-next-line no-param-reassign
  file = effectiveFile;

  const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
  if (file.size > maxSize) {
    throw new Error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max: ${maxSize / 1024 / 1024}MB.`);
  }

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const gcsPath = `brands/${brandIgId}/${timestamp}-${safeName}`;

  const storage = getStorage();
  const bucket = storage.bucket(BUCKET_NAME);
  const blob = bucket.file(gcsPath);

  const buffer = Buffer.from(await file.arrayBuffer());
  await blob.save(buffer, {
    contentType: file.type,
    metadata: { cacheControl: 'public, max-age=31536000' },
    public: true,
  }).catch(async () => {
    // Fallback: upload without public flag (uniform bucket-level access)
    await blob.save(buffer, {
      contentType: file.type,
      metadata: { cacheControl: 'public, max-age=31536000' },
    });
  });

  // Use a long-lived signed URL (Instagram needs to fetch this at publish time)
  const [signedUrl] = await blob.getSignedUrl({
    action: 'read',
    expires: Date.now() + 90 * 24 * 60 * 60 * 1000, // 90 days
  });
  const url = signedUrl;

  return {
    url,
    gcsPath,
    mediaType: isFont ? 'FONT' : isSvg ? 'SVG' : isVideo ? 'VIDEO' : 'IMAGE',
    size: file.size,
  };
}
