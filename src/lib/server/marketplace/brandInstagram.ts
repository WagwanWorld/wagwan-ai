import { INSTAGRAM_APP_ID, INSTAGRAM_APP_SECRET } from '$env/static/private';
import { PUBLIC_BASE_URL } from '$env/static/public';

const BRAND_REDIRECT_URI = `${PUBLIC_BASE_URL}/auth/brand-instagram/callback`;
const BRAND_SCOPES = 'instagram_business_basic,instagram_business_content_publish,instagram_manage_insights,instagram_manage_comments';

export function getBrandInstagramAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    redirect_uri: BRAND_REDIRECT_URI,
    response_type: 'code',
    scope: BRAND_SCOPES,
    state,
  });
  return `https://api.instagram.com/oauth/authorize?${params}`;
}

export async function exchangeBrandCodeForToken(code: string): Promise<string> {
  const body = new URLSearchParams({
    client_id: INSTAGRAM_APP_ID,
    client_secret: INSTAGRAM_APP_SECRET,
    grant_type: 'authorization_code',
    redirect_uri: BRAND_REDIRECT_URI,
    code,
  });
  const res = await fetch('https://api.instagram.com/oauth/access_token', {
    method: 'POST',
    body,
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`IG token exchange failed (${res.status}): ${txt}`);
  }
  const data = await res.json();
  const shortToken = data.access_token;

  // Exchange for long-lived token (60 days)
  const llRes = await fetch(
    `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${INSTAGRAM_APP_SECRET}&access_token=${shortToken}`,
  );
  if (!llRes.ok) {
    return shortToken;
  }
  const llData = await llRes.json();
  return llData.access_token ?? shortToken;
}

export async function refreshBrandToken(token: string): Promise<{ token: string; expiresAt: Date }> {
  const res = await fetch(
    `https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=${token}`,
  );
  if (!res.ok) throw new Error('Token refresh failed');
  const data = await res.json();
  const expiresAt = new Date(Date.now() + (data.expires_in ?? 5184000) * 1000);
  return { token: data.access_token, expiresAt };
}

export interface BrandIgProfile {
  id: string;
  username: string;
  name: string;
  profile_picture_url: string;
  followers_count: number;
}

export async function fetchBrandProfile(token: string): Promise<BrandIgProfile> {
  const res = await fetch(
    `https://graph.instagram.com/v25.0/me?fields=id,username,name,profile_picture_url,followers_count&access_token=${token}`,
  );
  if (!res.ok) throw new Error('Failed to fetch brand profile');
  return res.json();
}
