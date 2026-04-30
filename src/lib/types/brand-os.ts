export type TrendDirection = 'up' | 'down' | 'flat';

export interface ExecutiveMetric {
  label: string;
  value: string;
  delta?: string;
  trend?: TrendDirection;
  note?: string;
}

export interface AudiencePersona {
  name: string;
  description: string;
}

export interface AudienceInsight {
  title: string;
  value: string;
  rationale: string;
}

export interface BrandSynopsis {
  headline: string;
  whatHappened: string;
  whyItHappened: string;
  whatNext: string[];
  confidenceLabel: string;
}

export interface BrandKit {
  messagingPillars: string[];
  visualDirection: {
    palette: string;
    mood: string;
    composition: string;
    doDonts: string[];
  };
  campaignRules: string[];
  audiencePersonas: AudiencePersona[];
  contentCalendar: Array<{
    day: string;
    slot: string;
    pillar: string;
    concept: string;
  }>;
}

export interface CampaignSummary {
  id: string;
  title: string;
  status: string;
  rewardInr: number;
  createdAt: string;
  counts: Record<string, number>;
}

export interface ContentPipelineSummary {
  draft: number;
  scheduled: number;
  published: number;
  failed: number;
  latestPosts: Array<{
    id: string;
    caption: string;
    mediaType: string;
    status: string;
    scheduledAt: string | null;
    permalink: string | null;
  }>;
}

export interface RecentPost {
  id: string;
  thumbnail: string;
  type: string;
  likes: number;
  comments: number;
  permalink: string;
}

export interface CreatorMatch {
  googleSub: string;
  name: string;
  handle: string;
  followerCount: number;
  score: number;
  reasoning: string;
  themes: string[];
  location: string;
  profilePic: string;
}

export interface BrandSchemeColor {
  name: string;
  hex: string;
  role: 'primary' | 'secondary' | 'accent' | 'neutral' | 'background';
}

export interface BrandSchemeFont {
  family: string;
  weights: number[];
  source: 'google' | 'adobe' | 'system' | 'custom';
}

export interface BrandScheme {
  scrapedAt: string;
  sourceUrl: string;
  logo: {
    darkUrl: string | null;
    lightUrl: string | null;
    faviconUrl: string | null;
  };
  palette: BrandSchemeColor[];
  typography: {
    heading: BrandSchemeFont;
    body: BrandSchemeFont;
    mono?: BrandSchemeFont;
  };
  tagline: string | null;
  applications: {
    igPost: { description: string; imageUrl?: string };
    businessCard: { description: string; imageUrl?: string };
    websiteHeader: { description: string; imageUrl?: string };
    socialBanner: { description: string; imageUrl?: string };
  };
}

export interface BrandOsDashboard {
  generatedAt: string;
  executive: {
    brandName: string;
    handle: string;
    lastUpdated: string | null;
    metrics: ExecutiveMetric[];
  };
  audienceInsights: {
    summary: string;
    personas: AudiencePersona[];
    keyInsights: AudienceInsight[];
  };
  synopsis: BrandSynopsis;
  brandKit: BrandKit;
  campaignOps: {
    activeCount: number;
    campaigns: CampaignSummary[];
  };
  contentOps: ContentPipelineSummary;
  recentPosts: RecentPost[];
  brandVibes: string[];
  creatorMatches: CreatorMatch[];
  brandScheme?: BrandScheme;
}

