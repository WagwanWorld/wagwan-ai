import type { CreatorInviteLinks } from '$lib/types/creator-invite';

export function buildInstagramLinks(
  handle: string,
): Pick<CreatorInviteLinks, 'instagramProfile' | 'instagramApp'> {
  const h = handle.replace(/^@/, '');
  return {
    instagramProfile: `https://www.instagram.com/${encodeURIComponent(h)}/`,
    instagramApp: `instagram://user?username=${encodeURIComponent(h)}`,
  };
}

export function deliveryLabel(status: string): string {
  if (status === 'sent_manual') return 'Sent';
  if (status === 'copied') return 'Copied';
  return 'Draft';
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export async function patchRosterDelivery(
  id: string,
  delivery_status: 'copied' | 'sent_manual',
): Promise<boolean> {
  try {
    const res = await fetch('/api/brand/creator-roster', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id, delivery_status }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteRosterEntry(id: string): Promise<boolean> {
  try {
    const res = await fetch('/api/brand/creator-roster', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export function openInstagramDmFlow(
  links: Pick<CreatorInviteLinks, 'instagramProfile' | 'instagramApp'>,
): void {
  const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
  if (isMobile) {
    window.location.href = links.instagramApp;
    setTimeout(() => window.open(links.instagramProfile, '_blank', 'noopener,noreferrer'), 400);
  } else {
    window.open(links.instagramProfile, '_blank', 'noopener,noreferrer');
  }
}

export function formatFollowersDisplay(count: number | null, raw: string): string {
  if (count != null && count > 0) {
    if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return count.toLocaleString('en-US');
  }
  return raw || '—';
}

export function avatarGradient(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  const hue = Math.abs(h) % 360;
  const h2 = (hue + 35) % 360;
  return `linear-gradient(160deg, hsl(${hue}, 40%, 88%), hsl(${h2}, 35%, 78%))`;
}
