import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import { uploadCreativeToGCS } from '$lib/server/marketplace/gcsUpload';

export const POST: RequestHandler = async ({ request }) => {
  const igUserId = assertBrandAccess(request);
  if (!igUserId) throw error(401, 'Brand IG session required');

  const formData = await request.formData();
  const files = formData.getAll('files') as File[];
  if (!files.length) throw error(400, 'No files provided');
  if (files.length > 10) throw error(400, 'Max 10 files per upload');

  const results = [];
  const errors = [];

  for (const file of files) {
    try {
      const result = await uploadCreativeToGCS(file, igUserId);
      results.push(result);
    } catch (e) {
      errors.push({ file: file.name, error: e instanceof Error ? e.message : 'Upload failed' });
    }
  }

  return json({ ok: true, uploads: results, errors });
};
