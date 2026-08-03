import type { Actions } from '@sveltejs/kit';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { fail } from '@sveltejs/kit';

export const actions = {
  default: async ({ request }: { request: Request }) => {
    const formData = await request.formData();
    const name = formData.get('name')?.toString().trim();
    const company = formData.get('company')?.toString().trim();
    const signature = formData.get('signature')?.toString();

    if (!name || !company || !signature) {
      return fail(400, {
        error: 'Please fill in your name, company name, and provide your signature.',
        name,
        company,
      });
    }

    if (!isSupabaseConfigured()) {
      return fail(500, { error: 'Service temporarily unavailable. Please try again later.' });
    }

    try {
      const sb = getServiceSupabase();
      const signedAt = new Date();
      const { error } = await sb.from('signed_agreements').insert({
        signer_name: name,
        company_name: company,
        signature_data: signature,
        agreement_type: 'service_agreement_fuzone',
        signed_at: signedAt.toISOString(),
        ip_address: null,
      });

      if (error) {
        console.error('Failed to save agreement:', error);
        return fail(500, { error: 'Failed to save agreement. Please try again.' });
      }

      return {
        success: true,
        name,
        company,
        signature,
        signedDate: signedAt.toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      };
    } catch (err) {
      console.error('Agreement submission error:', err);
      return fail(500, { error: 'An unexpected error occurred. Please try again.' });
    }
  },
};
