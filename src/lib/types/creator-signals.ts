export type SignalType = 'roster_add' | 'brief_invite' | 'campaign_match';

export type CreatorBrandSignal = {
  id: string;
  creator_google_sub: string;
  signal_type: SignalType;
  brand_id: string;
  roster_entry_id: string | null;
  brand_name: string;
  brand_handle: string | null;
  brand_profile_picture: string | null;
  invite_message: string | null;
  fit_label: string | null;
  fit_score: number | null;
  analysis_snapshot: Record<string, unknown>;
  seen: boolean;
  seen_at: string | null;
  created_at: string;
};

/** Payload returned to the client (strips creator_google_sub) */
export type CreatorBrandSignalView = Omit<CreatorBrandSignal, 'creator_google_sub'>;
