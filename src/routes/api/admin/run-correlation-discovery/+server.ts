import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';
import { runCorrelationDiscovery } from '$lib/server/brand/correlationDiscovery';

export const POST: RequestHandler = async ({ request }) => {
  let body: { secret?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  if (!body.secret || body.secret !== env.ADMIN_SECRET) {
    throw error(401, 'Unauthorized');
  }

  // Run in background, return immediately
  runCorrelationDiscovery().catch(console.error);

  return json({ status: 'started', message: 'Correlation discovery running in background' });
};
