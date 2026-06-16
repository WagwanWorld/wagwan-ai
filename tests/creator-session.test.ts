import { describe, expect, it, vi } from 'vitest';
import {
  CREATOR_SESSION_COOKIE,
  getCreatorSessionSubFromRequest,
  mintCreatorSessionCookieValue,
  verifyCreatorSessionCookieValue,
} from '../src/lib/server/creatorSession';

describe('creator session cookies', () => {
  it('round-trips a signed account sub', () => {
    const raw = mintCreatorSessionCookieValue('ig:12345');

    expect(verifyCreatorSessionCookieValue(raw)).toBe('ig:12345');
    expect(
      getCreatorSessionSubFromRequest(
        new Request('https://wagwan.test', {
          headers: { cookie: `${CREATOR_SESSION_COOKIE}=${encodeURIComponent(raw)}` },
        }),
      ),
    ).toBe('ig:12345');
  });

  it('rejects a tampered account sub', () => {
    const raw = mintCreatorSessionCookieValue('ig:12345');
    const tampered = raw.replace('MTIzNDU', 'OTk5OTk');

    expect(verifyCreatorSessionCookieValue(tampered)).toBeNull();
  });

  it('rejects expired sessions', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-16T11:00:00Z'));
    const raw = mintCreatorSessionCookieValue('sub-1');

    vi.setSystemTime(new Date('2026-06-24T11:00:01Z'));
    expect(verifyCreatorSessionCookieValue(raw)).toBeNull();

    vi.useRealTimers();
  });
});
