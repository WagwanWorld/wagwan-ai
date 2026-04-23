/**
 * Pure helpers for the brand → creator → payout state machine.
 * No Supabase / environment imports so these can be unit-tested cheaply.
 *
 * Source of truth for the DB check constraints lives in
 * supabase/011_flow_hardening.sql.
 */

export type BriefStatus = 'sent' | 'accepted' | 'declined' | 'live' | 'completed';
export type EarningStatus = 'pending' | 'available' | 'withdrawn' | 'paid';

export const BRIEF_TRANSITIONS: Record<BriefStatus, BriefStatus[]> = {
  sent: ['accepted', 'declined'],
  accepted: ['live'],
  live: ['completed'],
  declined: [],
  completed: [],
};

/**
 * 'paid' is retained for backwards compatibility with rows created before the
 * 'withdrawn' status existed; no new rows should land in that state.
 */
export const EARNING_TRANSITIONS: Record<EarningStatus, EarningStatus[]> = {
  pending: ['available'],
  available: ['withdrawn'],
  withdrawn: [],
  paid: [],
};

export function canTransitionBrief(from: BriefStatus, to: BriefStatus): boolean {
  return BRIEF_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionEarning(from: EarningStatus, to: EarningStatus): boolean {
  return EARNING_TRANSITIONS[from]?.includes(to) ?? false;
}

/** Campaign ids are Postgres UUIDs (see 011_flow_hardening). */
export function isCampaignUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
  );
}
