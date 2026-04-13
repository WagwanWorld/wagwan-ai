import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Brand tools live at /brands/portal (outside user onboarding). */
export const load: PageServerLoad = async () => {
  redirect(308, '/brands/portal');
};
