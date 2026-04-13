/**
 * POST /api/google/gmail/draft — create a Gmail draft (gmail.compose).
 */
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createGmailDraft, refreshGoogleToken } from '$lib/server/google';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const { accessToken, refreshToken, to, subject, body: mailBody } = body as {
    accessToken?: string;
    refreshToken?: string;
    to?: string;
    subject?: string;
    body?: string;
  };

  if (!accessToken || !to || !subject || mailBody == null) {
    return json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }
  if (!EMAIL_RE.test(String(to).trim())) {
    return json({ ok: false, error: 'invalid_recipient' }, { status: 400 });
  }

  let token = accessToken;
  let result = await createGmailDraft(token, {
    to: String(to).trim(),
    subject: String(subject).trim(),
    body: String(mailBody),
  });

  if (!result && refreshToken) {
    try {
      token = await refreshGoogleToken(refreshToken);
      result = await createGmailDraft(token, {
        to: String(to).trim(),
        subject: String(subject).trim(),
        body: String(mailBody),
      });
    } catch {
      /* ignore */
    }
  }

  return json({
    ok: !!result,
    draftId: result?.id,
    newToken: token !== accessToken ? token : undefined,
  });
};
