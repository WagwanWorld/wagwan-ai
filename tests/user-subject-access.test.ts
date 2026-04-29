import { describe, expect, it } from 'vitest';
import { isUserSubjectAuthorized } from '../src/lib/server/userSubjectAccessRules';

describe('user subject access rules', () => {
  it('allows a linked profile to mutate only its own subject rows', () => {
    expect(isUserSubjectAuthorized('google-sub-1', 'google-sub-1')).toBe(true);
    expect(isUserSubjectAuthorized(' google-sub-1 ', 'google-sub-1')).toBe(true);
  });

  it('rejects missing or different linked profile subjects', () => {
    expect(isUserSubjectAuthorized('', 'google-sub-1')).toBe(false);
    expect(isUserSubjectAuthorized(null, 'google-sub-1')).toBe(false);
    expect(isUserSubjectAuthorized('google-sub-2', 'google-sub-1')).toBe(false);
  });
});
