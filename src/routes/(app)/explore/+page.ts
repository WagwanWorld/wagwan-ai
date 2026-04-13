import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

/** Explore is merged into Home + AI flows; keep route from 404 for old links. */
export const load: PageLoad = () => {
  throw redirect(302, '/home');
};
