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

export type AnalysisResponse = {
  appId: number;
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
  analysis: AnalysisResult;
};

