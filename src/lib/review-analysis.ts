import type { ReviewStats, ReviewTopic } from "@/types/analysis";
import type { SteamReview } from "@/types/steam";

const KEYWORD_PATTERNS: Record<string, RegExp[]> = {
  refund: [/\brefund\b/i, /\brefunded\b/i],
  crash: [/\bcrash(?:es|ed|ing)?\b/i, /\bfreeze(?:s|d|ing)?\b/i],
  server: [/\bserver(?:s)?\b/i, /\blag\b/i, /\bdisconnect(?:ed|s|ing)?\b/i],
  optimization: [/\boptim(?:ization|ised|ized)\b/i, /\bstutter(?:ing)?\b/i, /\bfps\b/i, /\bframe(?:rate)?\b/i],
  anti_cheat: [/\banti[\s-]?cheat\b/i, /\beac\b/i, /\bkernel level\b/i],
  pricing: [/\bprice\b/i, /\bpriced\b/i, /\bcost\b/i, /\bdlc\b/i, /\bmicrotransaction(?:s)?\b/i],
  translation: [/\btranslation\b/i, /\blocali[sz]ation\b/i, /\bsubtitle(?:s)?\b/i, /\btext\b/i],
  ui_ux: [/\bui\b/i, /\bux\b/i, /\bmenu(?:s)?\b/i, /\bcontroller\b/i],
};

const TOPIC_RULES: Array<{ name: string; patterns: RegExp[] }> = [
  {
    name: "performance",
    patterns: [/\bstutter(?:ing)?\b/i, /\bfps\b/i, /\boptimization\b/i, /\bframe(?:rate)?\b/i, /\bperformance\b/i],
  },
  {
    name: "crashes_and_bugs",
    patterns: [/\bcrash(?:es|ed|ing)?\b/i, /\bbug(?:s)?\b/i, /\bfreeze(?:s|d|ing)?\b/i, /\bglitch(?:es)?\b/i],
  },
  {
    name: "servers_and_matchmaking",
    patterns: [/\bserver(?:s)?\b/i, /\bmatchmaking\b/i, /\blobby\b/i, /\bdisconnect(?:ed|s|ing)?\b/i, /\bqueue\b/i],
  },
  {
    name: "ui_ux",
    patterns: [/\bui\b/i, /\bux\b/i, /\bmenu(?:s)?\b/i, /\bhud\b/i, /\bcontroller\b/i, /\bkeybind/i],
  },
  {
    name: "pricing_and_monetization",
    patterns: [/\bprice\b/i, /\bdlc\b/i, /\bmicrotransaction(?:s)?\b/i, /\bpay(?:2| to )win\b/i, /\bbattle pass\b/i],
  },
  {
    name: "gameplay_and_balance",
    patterns: [/\bgameplay\b/i, /\bcombat\b/i, /\bbalance\b/i, /\bweapon(?:s)?\b/i, /\bdifficulty\b/i],
  },
  {
    name: "content_and_progression",
    patterns: [/\bcontent\b/i, /\bendgame\b/i, /\bquest(?:s)?\b/i, /\bprogress(?:ion)?\b/i, /\bgrind(?:y|ing)?\b/i],
  },
  {
    name: "localization",
    patterns: [/\btranslation\b/i, /\blocali[sz]ation\b/i, /\bsubtitle(?:s)?\b/i],
  },
];

function round1(value: number) {
  return Math.round(value * 10) / 10;
}

function bucketPlaytime(minutes?: number) {
  if (!Number.isFinite(minutes) || typeof minutes !== "number") return "unknown";
  if (minutes < 120) return "<2h";
  if (minutes < 600) return "2-10h";
  if (minutes < 1800) return "10-30h";
  if (minutes < 6000) return "30-100h";
  return "100h+";
}

function countMatches(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text)) ? 1 : 0;
}

export function getReviewStats(reviews: SteamReview[]): ReviewStats {
  const totalReviews = reviews.length;
  const positive = reviews.filter((review) => review.votedUp === true).length;
  const negative = reviews.filter((review) => review.votedUp === false).length;
  const positivePct = totalReviews ? round1((positive / totalReviews) * 100) : 0;
  const negativePct = totalReviews ? round1((negative / totalReviews) * 100) : 0;

  const languageDistribution = [...reviews.reduce((map, review) => {
    const key = (review.language || "unknown").toLowerCase();
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>())]
    .map(([language, count]) => ({ language, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const playtimeBuckets = [...reviews.reduce((map, review) => {
    const key = bucketPlaytime(review.playtimeForeverMinutes);
    map.set(key, (map.get(key) ?? 0) + 1);
    return map;
  }, new Map<string, number>())]
    .map(([bucket, count]) => ({ bucket, count }))
    .sort((a, b) => b.count - a.count);

  const sortedByTime = [...reviews].sort((a, b) => b.timestampCreated - a.timestampCreated);
  const splitIndex = Math.max(1, Math.floor(sortedByTime.length / 2));
  const recentHalf = sortedByTime.slice(0, splitIndex);
  const earlierHalf = sortedByTime.slice(splitIndex);
  const recentNegativePct = recentHalf.length
    ? round1((recentHalf.filter((review) => review.votedUp === false).length / recentHalf.length) * 100)
    : 0;
  const earlierNegativePct = earlierHalf.length
    ? round1((earlierHalf.filter((review) => review.votedUp === false).length / earlierHalf.length) * 100)
    : recentNegativePct;

  const keywordHits = Object.entries(KEYWORD_PATTERNS)
    .map(([keyword, patterns]) => ({
      keyword,
      count: reviews.reduce((sum, review) => sum + countMatches(review.text, patterns), 0),
    }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count);

  return {
    totalReviews,
    positive,
    negative,
    positivePct,
    negativePct,
    languageDistribution,
    playtimeBuckets,
    recentSentimentShift: {
      recentNegativePct,
      earlierNegativePct,
      deltaPct: round1(recentNegativePct - earlierNegativePct),
    },
    keywordHits,
  };
}

export function extractReviewTopics(reviews: SteamReview[]): ReviewTopic[] {
  const topics = TOPIC_RULES.map((rule) => {
    const matchedReviews = reviews.filter((review) =>
      rule.patterns.some((pattern) => pattern.test(review.text)),
    );

    return {
      name: rule.name,
      count: matchedReviews.length,
      examples: matchedReviews
        .slice(0, 3)
        .map((review) => review.text.trim().replace(/\s+/g, " ").slice(0, 140))
        .filter(Boolean),
    };
  })
    .filter((topic) => topic.count > 0)
    .sort((a, b) => b.count - a.count);

  return topics;
}
