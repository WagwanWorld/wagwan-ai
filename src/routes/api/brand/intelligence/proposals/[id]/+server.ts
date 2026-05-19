import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deprecationErrorPayload } from '$lib/server/brand/llmGovernance';

export const PATCH: RequestHandler = async () =>
  json(deprecationErrorPayload('/api/brand/intelligence/proposals/[id]'), { status: 410 });
