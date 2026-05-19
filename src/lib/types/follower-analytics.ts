/** Follower Analytics Types */

export interface FollowerSummary {
  current: number;
  followsCount: number;
  mediaCount: number;
  delta24h: number;
  delta7d: number;
  delta30d: number;
  growthRate7d: number;
  growthRate30d: number;
  asOf: string;
}

export interface GrowthPoint {
  date: string;
  followers: number;
  netNew: number;
}

export interface GrowthSeries {
  series: GrowthPoint[];
  range: '30d' | '90d';
}

export interface DemographicEntry {
  dimensionValue: string;
  count: number;
  percentage: number;
}

export interface DemographicBreakdown {
  breakdown: 'age' | 'gender' | 'city' | 'country';
  data: DemographicEntry[];
  snapshotWeek: string;
}

export interface HeatmapCell {
  day: number;
  hour: number;
  value: number;
  dayName?: string;
}

export interface ActivityHeatmap {
  grid: HeatmapCell[];
  recommendedWindows: HeatmapCell[];
  snapshotWeek: string;
}

export interface PostAttribution {
  postId: string;
  mediaType: string;
  postedAt: string;
  captionPreview: string;
  permalink: string;
  reach: number;
  follows: number;
  profileActivity: number;
  reachFollowers: number;
  reachNonFollowers: number;
  conversionRate: number;
}

export interface ReachMix {
  followerReach: number;
  nonFollowerReach: number;
  totalReach: number;
  nonFollowerPct: number;
}

export interface MomentumData {
  momentum: number;
  avg7d: number;
  avg28d: number;
  trend: 'accelerating' | 'steady' | 'decelerating';
}
