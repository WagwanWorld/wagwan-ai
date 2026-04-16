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
const ALLOWED_IMAGE_TYPES = ['image/jpeg'];
const ALLOWED_VIDEO_TYPES = ['video/mp4'];

export interface UploadResult {
  url: string;
  gcsPath: string;
  mediaType: 'IMAGE' | 'VIDEO';
  size: number;
}

export async function uploadCreativeToGCS(
  file: File,
  brandIgId: string,
): Promise<UploadResult> {
  const isImage = ALLOWED_IMAGE_TYPES.includes(file.type);
  const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
  if (!isImage && !isVideo) {
    throw new Error(`Unsupported file type: ${file.type}. Use JPEG for images or MP4 for video.`);
  }

  const maxSize = isImage ? MAX_IMAGE_SIZE : MAX_VIDEO_SIZE;
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
  });

  // Make publicly readable
  await blob.makePublic();
  const url = `https://storage.googleapis.com/${BUCKET_NAME}/${gcsPath}`;

  return {
    url,
    gcsPath,
    mediaType: isImage ? 'IMAGE' : 'VIDEO',
    size: file.size,
  };
}
