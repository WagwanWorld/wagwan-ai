import { describe, expect, it } from 'vitest';
import {
  accountKeyMatchesInstagram,
  normalizeInstagramHandle,
} from '../src/lib/server/creatorInviteLinkAuth';

describe('normalizeInstagramHandle', () => {
  it('normalizes case, whitespace, and @ prefixes', () => {
    expect(normalizeInstagramHandle('  @@Creator.Name  ')).toBe('creator.name');
  });
});

describe('accountKeyMatchesInstagram', () => {
  it('accepts Instagram id account keys', () => {
    expect(accountKeyMatchesInstagram('ig:17841400000000000', {
      id: '17841400000000000',
      username: 'creator',
    })).toBe(true);
  });

  it('accepts legacy Instagram username account keys case-insensitively', () => {
    expect(accountKeyMatchesInstagram('ig:user:creator.name', {
      id: '17841400000000000',
      username: 'Creator.Name',
    })).toBe(true);
  });

  it('rejects unrelated creator account keys', () => {
    expect(accountKeyMatchesInstagram('google-sub-victim', {
      id: '17841400000000000',
      username: 'creator',
    })).toBe(false);
  });
});
