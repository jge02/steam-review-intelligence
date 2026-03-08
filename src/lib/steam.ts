import { readJsonCache, writeJsonCache } from "@/lib/cache";
import type {
  SteamFetchOptions,
  SteamGameSearchResult,
  SteamReview,
  SteamReviewsResponse,
} from "@/types/steam";

function clampCount(count: number) {
  if (!Number.isFinite(count)) return 100;
  return Math.max(1, Math.min(300, Math.floor(count)));
}

function normalizeLanguage(language: string) {
  const lang = (language || "all").trim().toLowerCase();
  return lang.length ? lang : "all";
}

function cacheKey(opts: SteamFetchOptions) {
  return `steam-reviews_${opts.appId}_${opts.filter ?? "recent"}_${opts.language}_${opts.count}_${opts.dayRange ?? 365}_${opts.reviewType ?? "all"}`;
}

export type SteamReviewsFetchResult = {
  appId: number;
  language: string;
  totalReviews: number;
  positive: number;
  negative: number;
  reviews: SteamReview[];
  rawQuerySummary?: SteamReviewsResponse["query_summary"];
};

export type ResolveGameResult = {
  query: string;
  exactMatch?: SteamGameSearchResult;
  candidates: SteamGameSearchResult[];
};

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function resolveGameToAppId(query: string): Promise<ResolveGameResult> {
  const normalized = normalizeQuery(query);
  if (!normalized) {
    throw new Error("Game name query is empty.");
  }

  const cacheKey = `steam-game-search_${encodeURIComponent(normalized)}`;
  const cached = await readJsonCache<ResolveGameResult>(cacheKey);
  if (cached) return cached;

  const url = new URL("https://store.steampowered.com/api/storesearch/");
  url.searchParams.set("term", query.trim());
  url.searchParams.set("l", "english");
  url.searchParams.set("cc", "US");

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": "SteamReviewIntelligence/0.2 (agent demo)" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Steam search request failed (HTTP ${res.status}).`);
  }

  const data = (await res.json()) as {
    items?: Array<{
      id?: number;
      name?: string;
      tiny_image?: string;
      price?: { final_formatted?: string };
      platforms?: { windows?: boolean; mac?: boolean; linux?: boolean };
    }>;
  };

  const candidates: SteamGameSearchResult[] = (data.items ?? [])
    .map((item): SteamGameSearchResult | null => {
      if (!item.id || !item.name) return null;
      return {
        appId: item.id,
        name: item.name,
        tinyImage: item.tiny_image,
        price: item.price?.final_formatted,
        platforms: item.platforms,
      };
    })
    .filter((item): item is SteamGameSearchResult => item !== null)
    .slice(0, 6);

  const exactMatch = candidates.find((item) => normalizeQuery(item.name) === normalized);
  const result: ResolveGameResult = {
    query: query.trim(),
    exactMatch,
    candidates,
  };

  await writeJsonCache(cacheKey, result);
  return result;
}

export async function fetchSteamReviews(
  options: SteamFetchOptions,
): Promise<SteamReviewsFetchResult> {
  const appId = Number(options.appId);
  if (!Number.isInteger(appId) || appId <= 0) {
    throw new Error("Invalid Steam App ID.");
  }

  const count = clampCount(options.count);
  const language = normalizeLanguage(options.language);
  const filter = options.filter ?? "recent";
  const dayRange =
    Number.isFinite(options.dayRange) && (options.dayRange ?? 0) > 0
      ? Math.min(3650, Math.floor(options.dayRange as number))
      : 365;
  const reviewType = options.reviewType ?? "all";

  const key = cacheKey({ appId, count, language, filter, dayRange, reviewType });
  const cached = await readJsonCache<SteamReviewsFetchResult>(key);
  if (cached) return cached;

  function mapReview(
    r: NonNullable<SteamReviewsResponse["reviews"]>[number],
  ): SteamReview | null {
    const text = (r.review ?? "").trim();
    if (!text) return null;
    const weighted = r.weighted_vote_score
      ? Number(r.weighted_vote_score)
      : undefined;

    return {
      id: r.recommendationid ?? crypto.randomUUID(),
      text,
      timestampCreated: r.timestamp_created ?? 0,
      timestampUpdated: r.timestamp_updated ?? 0,
      votedUp: r.voted_up,
      votesUp: r.votes_up,
      votesFunny: r.votes_funny,
      weightedVoteScore: Number.isFinite(weighted) ? weighted : undefined,
      language: r.language,
      receivedForFree: r.received_for_free,
      writtenDuringEarlyAccess: r.written_during_early_access,
      authorSteamId: r.author?.steamid,
      playtimeForeverMinutes: r.author?.playtime_forever,
      playtimeLastTwoWeeksMinutes: r.author?.playtime_last_two_weeks,
    };
  }

  const reviews: SteamReview[] = [];
  const seenIds = new Set<string>();
  let cursor = "*";
  let rawQuerySummary: SteamReviewsResponse["query_summary"];

  // Steam appreviews usually caps page size around 100; use cursor pagination to fill requested count.
  while (reviews.length < count) {
    const remaining = count - reviews.length;
    const pageSize = Math.min(100, remaining);

    const url = new URL(`https://store.steampowered.com/appreviews/${appId}`);
    url.searchParams.set("json", "1");
    url.searchParams.set("filter", filter); // "recent" keeps MVP snappy
    url.searchParams.set("language", language);
    url.searchParams.set("purchase_type", "all");
    url.searchParams.set("review_type", reviewType);
    url.searchParams.set("day_range", String(dayRange));
    url.searchParams.set("num_per_page", String(pageSize));
    url.searchParams.set("cursor", cursor);

    const res = await fetch(url.toString(), {
      // Steam is sensitive to request patterns; a UA helps avoid occasional blocks.
      headers: { "User-Agent": "SteamReviewIntelligence/0.1 (internal demo)" },
      cache: "no-store",
    });

    if (!res.ok) {
      throw new Error(`Steam API request failed (HTTP ${res.status}).`);
    }

    const data = (await res.json()) as SteamReviewsResponse;
    if (!data || typeof data.success !== "number" || data.success !== 1) {
      throw new Error("Steam API returned an unexpected response.");
    }

    rawQuerySummary ??= data.query_summary;
    const rawReviews = data.reviews ?? [];
    if (!rawReviews.length) break;

    let addedThisPage = 0;
    for (const raw of rawReviews) {
      const mapped = mapReview(raw);
      if (!mapped) continue;
      if (seenIds.has(mapped.id)) continue;
      seenIds.add(mapped.id);
      reviews.push(mapped);
      addedThisPage += 1;
      if (reviews.length >= count) break;
    }

    const nextCursor = data.cursor;
    if (!nextCursor || nextCursor === cursor) break;
    cursor = nextCursor;
    if (addedThisPage === 0) break;
  }

  const positive = reviews.filter((r) => r.votedUp === true).length;
  const negative = reviews.filter((r) => r.votedUp === false).length;

  const result: SteamReviewsFetchResult = {
    appId,
    language,
    totalReviews: reviews.length,
    positive,
    negative,
    reviews,
    rawQuerySummary,
  };

  await writeJsonCache(key, result);
  return result;
}
