import { describe, expect, it } from 'vitest';
import { isWalletSubjectAuthorized } from '../src/lib/server/walletAccessRules';

describe('wallet access rules', () => {
  it('allows a linked profile to mutate only its own ledger subject', () => {
    expect(isWalletSubjectAuthorized('google-sub-1', 'google-sub-1')).toBe(true);
  });

  it('rejects missing or different linked profile subjects', () => {
    expect(isWalletSubjectAuthorized('', 'google-sub-1')).toBe(false);
    expect(isWalletSubjectAuthorized(null, 'google-sub-1')).toBe(false);
    expect(isWalletSubjectAuthorized('google-sub-2', 'google-sub-1')).toBe(false);
  });
});
