import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

/** Chats deprecated for identity-first product direction. */
export const load: PageServerLoad = async () => {
  redirect(302, '/profile?from=chats');
};
