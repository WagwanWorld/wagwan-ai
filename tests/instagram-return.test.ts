import { describe, expect, it } from 'vitest';
import { instagramOAuthReturnBase } from '../src/lib/auth/instagramReturn';

describe('Instagram OAuth return routing', () => {
  it('returns creator-first join flow to /join', () => {
    expect(instagramOAuthReturnBase('join')).toBe('/join');
  });

  it('preserves existing Instagram return destinations', () => {
    expect(instagramOAuthReturnBase('landing')).toBe('/');
    expect(instagramOAuthReturnBase('profile')).toBe('/profile');
    expect(instagramOAuthReturnBase('onboarding')).toBe('/onboarding');
    expect(instagramOAuthReturnBase(undefined)).toBe('/onboarding');
  });
});
