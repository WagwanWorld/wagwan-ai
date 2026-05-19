import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deprecationErrorPayload } from '$lib/server/brand/llmGovernance';

export const GET: RequestHandler = async () =>
  json(deprecationErrorPayload('/api/brand/intelligence/audience'), { status: 410 });
