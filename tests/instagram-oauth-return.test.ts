import { describe, expect, it } from 'vitest';
import { instagramOAuthReturnBase } from '../src/lib/server/instagramOAuthReturn';

describe('instagramOAuthReturnBase', () => {
  it('returns users to the join gateway after join-origin Instagram OAuth', () => {
    expect(instagramOAuthReturnBase('join')).toBe('/join');
  });

  it('preserves existing OAuth origins', () => {
    expect(instagramOAuthReturnBase('landing')).toBe('/');
    expect(instagramOAuthReturnBase('profile')).toBe('/profile');
    expect(instagramOAuthReturnBase('onboarding')).toBe('/onboarding');
  });

  it('falls back unknown or missing origins to onboarding', () => {
    expect(instagramOAuthReturnBase('settings')).toBe('/onboarding');
    expect(instagramOAuthReturnBase(null)).toBe('/onboarding');
    expect(instagramOAuthReturnBase(undefined)).toBe('/onboarding');
  });
});
