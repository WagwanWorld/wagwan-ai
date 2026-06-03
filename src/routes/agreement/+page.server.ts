import type { Actions } from '@sveltejs/kit';
import { getServiceSupabase, isSupabaseConfigured } from '$lib/server/supabase';
import { fail } from '@sveltejs/kit';
import { validateAgreementSubmission } from '$lib/server/agreementValidation';

export const actions: Actions = {
  default: async ({ request, getClientAddress }) => {
    const formData = await request.formData();
    const validation = validateAgreementSubmission(
      formData.get('name'),
      formData.get('company'),
      formData.get('signature'),
    );

    if (!validation.ok) {
      return fail(400, {
        error: validation.message,
        name: formData.get('name')?.toString().trim(),
        company: formData.get('company')?.toString().trim(),
      });
    }

    const { name, company, signature } = validation.value;

    if (!isSupabaseConfigured()) {
      return fail(500, { error: 'Service temporarily unavailable. Please try again later.' });
    }

    try {
      const sb = getServiceSupabase();
      const { error } = await sb.from('signed_agreements').insert({
        signer_name: name,
        company_name: company,
        signature_data: signature,
        agreement_type: 'service_agreement_fuzone',
        signed_at: new Date().toISOString(),
        ip_address: getClientAddress(),
      });

      if (error) {
        console.error('Failed to save agreement:', error);
        return fail(500, { error: 'Failed to save agreement. Please try again.' });
      }

      return { success: true, name, company, signature };
    } catch (err) {
      console.error('Agreement submission error:', err);
      return fail(500, { error: 'An unexpected error occurred. Please try again.' });
    }
  },
};
