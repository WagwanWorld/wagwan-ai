/** Identity intelligence decision layer (strict JSON contract). Safe for client + server. */

export const IDENTITY_INTELLIGENCE_SCHEMA_VERSION = 1 as const;

export type IdentityIntelligenceMode =
  | 'building'
  | 'executing'
  | 'exploring'
  | 'consuming'
  | 'stuck'
  | 'transitioning';

export interface IdentityIntelligenceSnapshot {
  mode: IdentityIntelligenceMode;
  one_line_state: string;
  confidence: number;
}

export interface IdentityIntelligenceNow {
  focus: string;
  pressure: string;
  momentum: string;
}

export interface IdentityIntelligenceDecision {
  do_this_now: string;
  then_do: string[];
  stop_doing: string[];
  why_this_matters: string;
}

export interface IdentityIntelligenceBlindspot {
  issue: string;
  impact: string;
  fix: string;
}

export interface IdentityIntelligenceLeverage {
  unfair_advantages: string[];
  underused_assets: string[];
  quick_wins: string[];
}

export interface IdentityIntelligenceTrajectory {
  direction: string;
  risk: string;
  next_critical_move: string;
}

export interface IdentityIntelligencePersonalization {
  tone: string;
  style: string;
  response_format: string;
}

/** Strict model output shape (payload only). */
export interface IdentityIntelligencePayload {
  snapshot: IdentityIntelligenceSnapshot;
  now: IdentityIntelligenceNow;
  decision: IdentityIntelligenceDecision;
  blindspots: IdentityIntelligenceBlindspot[];
  leverage: IdentityIntelligenceLeverage;
  trajectory: IdentityIntelligenceTrajectory;
  personalization: IdentityIntelligencePersonalization;
}

/** Persisted under identity_graph.identityIntelligence */
export interface IdentityIntelligenceWrapper {
  version: typeof IDENTITY_INTELLIGENCE_SCHEMA_VERSION;
  generatedAt: string;
  userQuery?: string;
  payload: IdentityIntelligencePayload;
}
