import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deprecationErrorPayload } from '$lib/server/brand/llmGovernance';

export const GET: RequestHandler = async () =>
  json(deprecationErrorPayload('/api/brand/intelligence/competitors'), { status: 410 });

export const POST: RequestHandler = async () =>
  json(deprecationErrorPayload('/api/brand/intelligence/competitors:POST'), { status: 410 });
