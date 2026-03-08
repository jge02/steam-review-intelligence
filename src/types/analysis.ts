export type ComplaintSeverity = "low" | "medium" | "high" | "critical";

export type SentimentBreakdown = {
  positive: number;
  negative: number;
  neutral: number;
};

export type ThemeSummary = {
  theme: string;
  summary: string;
};

export type ComplaintSummary = {
  theme: string;
  summary: string;
  severity: ComplaintSeverity;
};

export type AnalysisResult = {
  overallSentiment: SentimentBreakdown;
  topPositiveFeedback: ThemeSummary[];
  topComplaints: ComplaintSummary[];
  keyPlayerConcerns: string[];
  representativeQuotes: string[];
  operationalInsights: string[];
  executiveSummary: string;
};

export type PlaytimeBucketStat = {
  bucket: string;
  count: number;
};

export type ReviewStats = {
  totalReviews: number;
  positive: number;
  negative: number;
  positivePct: number;
  negativePct: number;
  languageDistribution: Array<{ language: string; count: number }>;
  playtimeBuckets: PlaytimeBucketStat[];
  recentSentimentShift: {
    recentNegativePct: number;
    earlierNegativePct: number;
    deltaPct: number;
  };
  keywordHits: Array<{ keyword: string; count: number }>;
};

export type ReviewTopic = {
  name: string;
  count: number;
  examples: string[];
};

export type GameAnalysisContext = {
  appId: number;
  name: string;
  requestedReviewCount: number;
  language: string;
  fetchedReviewCount: number;
  steamSummary: {
    totalReviews: number;
    positive: number;
    negative: number;
    positivePct: number;
    negativePct: number;
  };
  stats: ReviewStats;
  topics: ReviewTopic[];
};

export type AnalysisResponse = {
  query: string;
  mode: "single_game" | "comparison";
  games: GameAnalysisContext[];
  analysis: AnalysisResult;
};
