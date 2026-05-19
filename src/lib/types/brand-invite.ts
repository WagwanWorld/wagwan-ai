export type BrandCampaignPreview = {
  title: string;
  creativeText: string;
  rewardInr: number | null;
  status: string;
};

export type BrandInviteContext = {
  brandId: string;
  name: string;
  initials: string;
  handle: string;
  profilePicture: string;
  followers: number;
  bio: string;
  aesthetic: string;
  lifestyle: string;
  tags: string[];
  colorPalette: string[];
  activeCampaignCount: number;
  campaigns: BrandCampaignPreview[];
  latestBrief: string;
  rewardRange: string;
  matchLine: string;
  brandPitch: string;
  inviteLine: string;
  instagramUrl: string;
  profileUrl: string;
};
