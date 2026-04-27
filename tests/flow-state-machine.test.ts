import { describe, expect, it } from 'vitest';
import {
  BRIEF_TRANSITIONS,
  EARNING_TRANSITIONS,
  canTransitionBrief,
  canTransitionEarning,
  type BriefStatus,
  type EarningStatus,
} from '../src/lib/server/flowState';

describe('brief-response state machine', () => {
  it('allows the canonical happy path sent -> accepted -> live -> completed', () => {
    expect(canTransitionBrief('sent', 'accepted')).toBe(true);
    expect(canTransitionBrief('accepted', 'live')).toBe(true);
    expect(canTransitionBrief('live', 'completed')).toBe(true);
  });

  it('allows sent -> declined but treats declined as terminal', () => {
    expect(canTransitionBrief('sent', 'declined')).toBe(true);
    expect(BRIEF_TRANSITIONS.declined).toEqual([]);
  });

  it('rejects skipping states (e.g. sent -> live, sent -> completed)', () => {
    expect(canTransitionBrief('sent', 'live')).toBe(false);
    expect(canTransitionBrief('sent', 'completed')).toBe(false);
    expect(canTransitionBrief('accepted', 'completed')).toBe(false);
  });

  it('does not allow stale creator actions to rewrite in-flight or terminal states', () => {
    expect(canTransitionBrief('accepted', 'declined')).toBe(false);
    expect(canTransitionBrief('live', 'accepted')).toBe(false);
    expect(canTransitionBrief('live', 'declined')).toBe(false);
    expect(canTransitionBrief('completed', 'accepted')).toBe(false);
    expect(canTransitionBrief('completed', 'declined')).toBe(false);
    expect(canTransitionBrief('declined', 'accepted')).toBe(false);
  });

  it('never allows a terminal state to move', () => {
    const terminals: BriefStatus[] = ['declined', 'completed'];
    const everyStatus: BriefStatus[] = ['sent', 'accepted', 'declined', 'live', 'completed'];
    for (const from of terminals) {
      for (const to of everyStatus) {
        expect(canTransitionBrief(from, to)).toBe(false);
      }
    }
  });

  it('does not allow moves back to sent', () => {
    const all: BriefStatus[] = ['accepted', 'declined', 'live', 'completed'];
    for (const from of all) {
      expect(canTransitionBrief(from, 'sent')).toBe(false);
    }
  });
});

describe('earnings ledger state machine', () => {
  it('follows pending -> available -> withdrawn', () => {
    expect(canTransitionEarning('pending', 'available')).toBe(true);
    expect(canTransitionEarning('available', 'withdrawn')).toBe(true);
  });

  it('never permits reopening withdrawn or paid rows', () => {
    expect(EARNING_TRANSITIONS.withdrawn).toEqual([]);
    expect(EARNING_TRANSITIONS.paid).toEqual([]);
    const all: EarningStatus[] = ['pending', 'available', 'withdrawn', 'paid'];
    for (const to of all) {
      expect(canTransitionEarning('withdrawn', to)).toBe(false);
      expect(canTransitionEarning('paid', to)).toBe(false);
    }
  });

  it('rejects skipping settlement (pending -> withdrawn)', () => {
    expect(canTransitionEarning('pending', 'withdrawn')).toBe(false);
  });
});
