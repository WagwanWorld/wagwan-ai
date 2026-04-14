import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { respondToBrief, completeBrief } from '$lib/server/creatorMarketplace';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body?.sub || !body?.campaignId) return json({ ok: false, error: 'missing_fields' }, { status: 400 });

  const action = body.action as string;

  if (action === 'accept' || action === 'decline') {
    const brief = await respondToBrief(body.sub, Number(body.campaignId), action);
    if (!brief) return json({ ok: false, error: 'response_failed' }, { status: 500 });

    // Generate WhatsApp link on accept
    let whatsappLink = '';
    if (action === 'accept' && body.phone) {
      const phone = String(body.phone).replace('+', '');
      const text = encodeURIComponent(body.briefText || 'Hi! I accepted your campaign brief on Wagwan.');
      whatsappLink = `https://wa.me/${phone}?text=${text}`;
    }

    return json({ ok: true, brief, whatsappLink });
  }

  if (action === 'complete') {
    if (!body.igPostUrl) return json({ ok: false, error: 'missing_ig_post_url' }, { status: 400 });
    const ok = await completeBrief(body.sub, Number(body.campaignId), body.igPostUrl);
    return json({ ok });
  }

  return json({ ok: false, error: 'invalid_action' }, { status: 400 });
};
