import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deprecationErrorPayload } from '$lib/server/brand/llmGovernance';

export const POST: RequestHandler = async () =>
  json(deprecationErrorPayload('/api/brand/intelligence/refresh'), { status: 410 });
