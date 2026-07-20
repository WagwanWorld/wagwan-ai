import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { assertBrandAccess } from '$lib/server/marketplace/brandAuth';
import {
  processCreatorInvite,
  resolveBrandForSession,
} from '$lib/server/marketplace/creatorInvite';
import { scrapeInstagram } from '$lib/server/marketplace/instagramScrape';
import { parseAndValidate } from '$lib/server/marketplace/sheetParser';
import { splitRowsByBrandRoster } from '$lib/server/marketplace/bulkRosterPrecheck';

const BATCH_SIZE = 20;

export const POST: RequestHandler = async ({ request }) => {
  if (!isSupabaseConfigured()) {
    throw error(503, 'Database not configured');
  }

  const brandIgUserId = assertBrandAccess(request);

  const formData = await request.formData().catch(() => null);
  if (!formData) throw error(400, 'Expected multipart/form-data');

  const file = formData.get('file');
  if (!file || !(file instanceof File)) throw error(400, 'No file uploaded');

  const maxSize = 5 * 1024 * 1024; // 5 MB
  if (file.size > maxSize) throw error(400, 'File too large (max 5 MB)');

  let buffer: ArrayBuffer;
  try {
    buffer = await file.arrayBuffer();
  } catch {
    throw error(400, 'Could not read file');
  }

  let validation: ReturnType<typeof parseAndValidate>;
  try {
    validation = parseAndValidate(buffer, file.name);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Could not parse file';
    throw error(400, msg);
  }

  const {
    valid,
    errors: validationErrors,
    skipped_no_handle,
    duplicates_in_file,
    total_rows,
  } = validation;

  const sb = getServiceSupabase();
  const { brandId } = await resolveBrandForSession(sb, brandIgUserId, 'Brand');
  const { alreadyInRoster, toProcess } = await splitRowsByBrandRoster(sb, brandId, valid);

  // Stream results via SSE
  const encoder = new TextEncoder();

  function sse(event: string, data: unknown): Uint8Array {
    return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  const stream = new ReadableStream({
    async start(controller) {
      // Send validation summary
      controller.enqueue(
        sse('validated', {
          total_rows,
          valid_count: toProcess.length,
          skipped_no_handle,
          duplicates_in_file,
          already_in_roster: alreadyInRoster,
          errors: validationErrors.slice(0, 20),
        }),
      );

      if (toProcess.length === 0) {
        controller.enqueue(sse('done', { total: 0, succeeded: 0, failed: 0, skipped: 0 }));
        controller.close();
        return;
      }

      let succeeded = 0;
      let failed = 0;
      let completed = 0;
      const total = toProcess.length;

      // Process in batches
      for (let batchStart = 0; batchStart < total; batchStart += BATCH_SIZE) {
        const batch = toProcess.slice(batchStart, batchStart + BATCH_SIZE);

        const results = await Promise.allSettled(
          batch.map(async (row) => {
            const result = await processCreatorInvite(
              sb,
              brandIgUserId,
              row.handle,
              scrapeInstagram,
            );

            // Merge extra sheet data into profile_snapshot
            const snapshot = result.profile as Record<string, unknown>;
            if (row.email) snapshot.email = row.email;
            if (row.phone) snapshot.phone = row.phone;
            if (row.rates) snapshot.rates = row.rates;
            if (row.notes) snapshot.notes = row.notes;
            if (row.tags) snapshot.tags = row.tags;
            if (row.location) snapshot.location = row.location;
            if (Object.keys(row.custom_fields).length > 0) {
              snapshot.custom_fields = row.custom_fields;
            }

            // Update the roster entry with merged snapshot
            const entryId = (result.entry as Record<string, unknown>).id as string;
            if (!entryId) {
              throw new Error('roster_entry_missing');
            }

            const { error: snapshotErr } = await sb
              .from('brand_creator_roster')
              .update({ profile_snapshot: snapshot })
              .eq('id', entryId)
              .eq('brand_id', brandId);

            if (snapshotErr) {
              throw new Error('roster_snapshot_update_failed');
            }

            return { handle: row.handle, analysis: result.analysis };
          }),
        );

        for (let i = 0; i < results.length; i++) {
          completed++;
          const r = results[i];
          const handle = batch[i].handle;

          if (r.status === 'fulfilled') {
            succeeded++;
            controller.enqueue(
              sse('progress', {
                handle,
                status: 'success',
                fit_label: r.value.analysis.fitLabel,
                fit_score: r.value.analysis.fitScore,
                completed,
                total,
              }),
            );
          } else {
            failed++;
            const errMsg = r.reason instanceof Error ? r.reason.message : 'Unknown error';
            controller.enqueue(
              sse('progress', {
                handle,
                status: 'failed',
                error: errMsg === 'profile_not_found' ? 'Profile not found' : errMsg,
                completed,
                total,
              }),
            );
          }
        }
      }

      controller.enqueue(
        sse('done', {
          total,
          succeeded,
          failed,
          skipped: alreadyInRoster + skipped_no_handle + duplicates_in_file,
        }),
      );
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
};
