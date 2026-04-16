import type { RequestHandler } from './$types';
import { runAudienceMatchingPipeline } from '$lib/server/brand/audienceMatchingPipeline';

export const POST: RequestHandler = async ({ request }) => {
  let body: { prompt?: string; brand_id?: string; options?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  if (prompt.length < 10) {
    return new Response(
      JSON.stringify({ error: 'Prompt too short — describe your target audience in more detail' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const brandId = body.brand_id ?? 'anonymous';
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (step: string, count: number) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ step, count })}\n\n`));
        } catch { /* stream closed */ }
      };

      try {
        const result = await runAudienceMatchingPipeline(prompt, brandId, emit);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, result })}\n\n`));
      } catch (e) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: String(e) })}\n\n`)
        );
      } finally {
        controller.close();
      }
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
