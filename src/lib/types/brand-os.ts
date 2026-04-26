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
}

