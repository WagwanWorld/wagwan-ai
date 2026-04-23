import { describe, expect, it } from 'vitest';
import { isCampaignUuid } from '../src/lib/server/flowState';

/**
 * Campaign IDs are Postgres UUIDs after migration 011. Any accidental
 * Number() coercion in API handlers would NaN out the id, so this test exists
 * to guard against the regression that previously broke the creator inbox.
 */
describe('isCampaignUuid (brief-response guard)', () => {
  it('accepts lowercase and uppercase v1–v5 UUIDs', () => {
    expect(isCampaignUuid('00000000-0000-0000-0000-000000000000')).toBe(true);
    expect(isCampaignUuid('1f3a9d22-0b3b-4d4b-9f8b-6a2d8c8f4e1c')).toBe(true);
    expect(isCampaignUuid('1F3A9D22-0B3B-4D4B-9F8B-6A2D8C8F4E1C')).toBe(true);
  });

  it('rejects bigint-style ids (the pre-migration schema)', () => {
    expect(isCampaignUuid('42')).toBe(false);
    expect(isCampaignUuid('9999999999')).toBe(false);
  });

  it('rejects non-strings and malformed UUIDs', () => {
    expect(isCampaignUuid(42)).toBe(false);
    expect(isCampaignUuid(null)).toBe(false);
    expect(isCampaignUuid(undefined)).toBe(false);
    expect(isCampaignUuid('')).toBe(false);
    expect(isCampaignUuid('not-a-uuid')).toBe(false);
    expect(isCampaignUuid('1f3a9d22-0b3b-4d4b-9f8b-6a2d8c8f4e1')).toBe(false);
  });

  it('is Number()-resistant (NaN coercion would silently pass a bare number)', () => {
    const uuid = '1f3a9d22-0b3b-4d4b-9f8b-6a2d8c8f4e1c';
    expect(Number.isFinite(Number(uuid))).toBe(false);
    expect(isCampaignUuid(uuid)).toBe(true);
  });
});
