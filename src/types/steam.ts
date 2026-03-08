export type SteamReview = {
  id: string;
  text: string;
  timestampCreated: number;
  timestampUpdated: number;
  votedUp?: boolean;
  votesUp?: number;
  votesFunny?: number;
  weightedVoteScore?: number;
  authorSteamId?: string;
  playtimeForeverMinutes?: number;
  playtimeLastTwoWeeksMinutes?: number;
  receivedForFree?: boolean;
  writtenDuringEarlyAccess?: boolean;
  language?: string;
};

export type SteamFetchOptions = {
  appId: number;
  count: number;
  language: string;
  filter?: "recent" | "all";
  dayRange?: number;
  reviewType?: "all" | "positive" | "negative";
};

export type SteamGameSearchResult = {
  appId: number;
  name: string;
  tinyImage?: string;
  price?: string;
  platforms?: {
    windows?: boolean;
    mac?: boolean;
    linux?: boolean;
  };
};

export type SteamQuerySummary = {
  num_reviews?: number;
  review_score?: number;
  review_score_desc?: string;
  total_positive?: number;
  total_negative?: number;
  total_reviews?: number;
};

export type SteamReviewsResponse = {
  success: number;
  cursor?: string;
  query_summary?: SteamQuerySummary;
  reviews?: Array<{
    recommendationid?: string;
    review?: string;
    timestamp_created?: number;
    timestamp_updated?: number;
    voted_up?: boolean;
    votes_up?: number;
    votes_funny?: number;
    weighted_vote_score?: string;
    language?: string;
    received_for_free?: boolean;
    written_during_early_access?: boolean;
    author?: {
      steamid?: string;
      playtime_forever?: number;
      playtime_last_two_weeks?: number;
    };
  }>;
};
