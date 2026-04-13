/**
 * Google OAuth userinfo → compact profile signals for the twin processor.
 */

export interface ProfileSignals {
  name: string;
  email_domain: string;
  locale: string;
  city: string;
}

export async function fetchGoogleProfileSignals(
  accessToken: string,
  mergeCity?: string,
): Promise<ProfileSignals> {
  let name = '';
  let email = '';
  let locale = '';
  try {
    const uRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (uRes.ok) {
      const u = (await uRes.json()) as { name?: string; email?: string; locale?: string };
      name = u.name ?? '';
      email = u.email ?? '';
      locale = u.locale ?? '';
    }
  } catch {
    /* ignore */
  }
  const email_domain = email.includes('@') ? email.split('@')[1] ?? '' : '';
  return {
    name,
    email_domain,
    locale,
    city: (mergeCity ?? '').trim(),
  };
}
