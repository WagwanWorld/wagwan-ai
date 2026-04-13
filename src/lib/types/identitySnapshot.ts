/** Identity compression snapshot — Stage 3 (strict JSON contract). Safe for client + server. */

export const IDENTITY_SNAPSHOT_SCHEMA_VERSION = 1 as const;

export interface IdentitySnapshotAestheticProfile {
  visual: string[];
  brands: string[];
  spaces: string[];
}

export interface IdentitySnapshotShoppingStyle {
  type: string;
  signals: string[];
}

export interface IdentitySnapshotTaste {
  music: string[];
  media: string[];
  cultural: string[];
}

export interface IdentitySnapshotSocialIdentity {
  how_people_see_you: string;
  actual_you: string;
}

export interface IdentitySnapshotStatus {
  level: string;
  direction: string;
}

/** Strict model output shape (payload only). */
export interface IdentitySnapshotPayload {
  one_liner: string;
  archetype: string;
  vibe: string[];
  identity_tags: string[];
  current_mode: string;
  core_contradiction: string;
  aesthetic_profile: IdentitySnapshotAestheticProfile;
  shopping_style: IdentitySnapshotShoppingStyle;
  taste: IdentitySnapshotTaste;
  social_identity: IdentitySnapshotSocialIdentity;
  status: IdentitySnapshotStatus;
}

/** Persisted under identity_graph.identitySnapshot */
export interface IdentitySnapshotWrapper {
  version: typeof IDENTITY_SNAPSHOT_SCHEMA_VERSION;
  generatedAt: string;
  payload: IdentitySnapshotPayload;
}
