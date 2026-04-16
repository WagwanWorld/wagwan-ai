import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { expandToLookalikes } from '$lib/server/brand/lookalikeExpander';

export const POST: RequestHandler = async ({ request }) => {
  let body: { query_id?: string; confirmed_cohort_ids?: string[]; expansion_factor?: number };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON');
  }

  if (!body.query_id || !body.confirmed_cohort_ids?.length) {
    throw error(400, 'query_id and confirmed_cohort_ids are required');
  }

  const lookalikes = await expandToLookalikes(
    body.confirmed_cohort_ids,
    body.query_id,
    body.expansion_factor ?? 3
  );

  return json({ lookalikes, count: lookalikes.length });
};
