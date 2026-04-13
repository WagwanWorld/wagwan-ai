/** Brand-portal LLM outputs (member brief + audience intel). */

/** Three tactical lines for a brand selling to / partnering with this member. */
export interface BrandMemberBrief {
  happening_now: string;
  do_next: string;
  missing: string;
}

/** Cohort-level monetization read for marketers. */
export interface BrandAudienceIntel {
  trying_to_achieve: string;
  struggling_with: string;
  content_that_converts: string;
  will_pay_for: string;
}
