import OpenAI from "openai";
import { z } from "zod";
import type {
  AnalysisResponse,
  AnalysisResult,
  GameAnalysisContext,
} from "@/types/analysis";
import type { SteamReview } from "@/types/steam";
import { extractReviewTopics, getReviewStats } from "@/lib/review-analysis";
import { fetchSteamReviews, resolveGameToAppId } from "@/lib/steam";

export type LlmProvider = "deepseek" | "openai" | "openai_compatible";

export type ReviewAgentInput = {
  query: string;
  appId?: number;
  language: string;
  count: number;
  llm: {
    provider: LlmProvider;
    model?: string;
  };
};

type ProviderConfig = {
  provider: LlmProvider;
  apiKey: string;
  baseURL?: string;
  model: string;
};

type LoadedGameContext = {
  game: GameAnalysisContext;
  reviews: SteamReview[];
};

const analysisResponseSchema = z.object({
  query: z.string(),
  mode: z.enum(["single_game", "comparison"]),
  games: z.array(
    z.object({
      appId: z.number(),
      name: z.string(),
      requestedReviewCount: z.number(),
      language: z.string(),
      fetchedReviewCount: z.number(),
      steamSummary: z.object({
        totalReviews: z.number(),
        positive: z.number(),
        negative: z.number(),
        positivePct: z.number(),
        negativePct: z.number(),
      }),
      stats: z.object({
        totalReviews: z.number(),
        positive: z.number(),
        negative: z.number(),
        positivePct: z.number(),
        negativePct: z.number(),
        languageDistribution: z.array(
          z.object({
            language: z.string(),
            count: z.number(),
          }),
        ),
        playtimeBuckets: z.array(
          z.object({
            bucket: z.string(),
            count: z.number(),
          }),
        ),
        recentSentimentShift: z.object({
          recentNegativePct: z.number(),
          earlierNegativePct: z.number(),
          deltaPct: z.number(),
        }),
        keywordHits: z.array(
          z.object({
            keyword: z.string(),
            count: z.number(),
          }),
        ),
      }),
      topics: z.array(
        z.object({
          name: z.string(),
          count: z.number(),
          examples: z.array(z.string()),
        }),
      ),
    }),
  ),
  analysis: z.object({
    overallSentiment: z.object({
      positive: z.number(),
      negative: z.number(),
      neutral: z.number(),
    }),
    topPositiveFeedback: z.array(
      z.object({
        theme: z.string(),
        summary: z.string(),
      }),
    ),
    topComplaints: z.array(
      z.object({
        theme: z.string(),
        summary: z.string(),
        severity: z.enum(["low", "medium", "high", "critical"]),
      }),
    ),
    keyPlayerConcerns: z.array(z.string()),
    representativeQuotes: z.array(z.string()),
    operationalInsights: z.array(z.string()),
    executiveSummary: z.string(),
  }),
});

function getProviderConfig(provider: LlmProvider, modelOverride?: string): ProviderConfig {
  if (provider === "deepseek") {
    const apiKey =
      process.env.DEEPSEEK_API_KEY ??
      process.env.DEESEEK_API_KEY ??
      process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing DEEPSEEK_API_KEY for DeepSeek provider.");
    }

    return {
      provider,
      apiKey,
      baseURL: process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com",
      model: modelOverride?.trim() || process.env.DEEPSEEK_MODEL || "deepseek-chat",
    };
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing OPENAI_API_KEY for OpenAI provider.");
    }

    return {
      provider,
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL,
      model: modelOverride?.trim() || process.env.OPENAI_MODEL || "gpt-4.1-mini",
    };
  }

  const apiKey = process.env.OPENAI_COMPAT_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_COMPAT_API_KEY for OpenAI-compatible provider.");
  }

  const baseURL = process.env.OPENAI_COMPAT_BASE_URL;
  if (!baseURL) {
    throw new Error("Missing OPENAI_COMPAT_BASE_URL for OpenAI-compatible provider.");
  }

  return {
    provider,
    apiKey,
    baseURL,
    model: modelOverride?.trim() || process.env.OPENAI_COMPAT_MODEL || "gpt-4o-mini",
  };
}

function buildGameContext(args: {
  appId: number;
  name: string;
  requestedReviewCount: number;
  language: string;
  reviews: SteamReview[];
}) {
  const stats = getReviewStats(args.reviews);
  const topics = extractReviewTopics(args.reviews);

  return {
    appId: args.appId,
    name: args.name,
    requestedReviewCount: args.requestedReviewCount,
    language: args.language,
    fetchedReviewCount: stats.totalReviews,
    steamSummary: {
      totalReviews: stats.totalReviews,
      positive: stats.positive,
      negative: stats.negative,
      positivePct: stats.positivePct,
      negativePct: stats.negativePct,
    },
    stats,
    topics,
  } satisfies GameAnalysisContext;
}

function extractJsonObject(text: string) {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    return trimmed.slice(start, end + 1);
  }

  return null;
}

function getFallbackAnalysis(games: GameAnalysisContext[]): AnalysisResult {
  const primary = games[0];
  const fallbackQuotes = primary?.topics.flatMap((topic) => topic.examples).slice(0, 3) ?? [];
  const topComplaints =
    primary?.topics.slice(0, 3).map((topic) => ({
      theme: topic.name,
      summary: `该主题在已抓取评论中出现 ${topic.count} 次，需要进一步确认根因。`,
      severity: "medium" as const,
    })) ?? [];

  return {
    overallSentiment: {
      positive: primary?.steamSummary.positivePct ?? 0,
      negative: primary?.steamSummary.negativePct ?? 0,
      neutral: 0,
    },
    topPositiveFeedback: [],
    topComplaints,
    keyPlayerConcerns: topComplaints.map((item) => item.theme),
    representativeQuotes: fallbackQuotes,
    operationalInsights: [
      "已完成评论抓取与聚合，但结构化总结阶段未返回有效结果，当前结果使用本地降级总结。",
    ],
    executiveSummary:
      "已完成评论抓取、统计和主题提取，但模型未返回有效结构化总结，因此展示的是降级结果。",
  };
}

export async function runReviewAgent(input: ReviewAgentInput): Promise<AnalysisResponse> {
  const config = getProviderConfig(input.llm.provider, input.llm.model);
  const client = new OpenAI({
    apiKey: config.apiKey,
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });

  const loadedGames = new Map<number, LoadedGameContext>();

  const tools = [
    {
      type: "function" as const,
      function: {
        name: "resolve_game_to_appid",
        description: "Resolve a Steam game name to candidate App IDs.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
          },
          required: ["name"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "fetch_steam_reviews",
        description:
          "Fetch Steam reviews for an app and cache the result. Use before stats/topic tools.",
        parameters: {
          type: "object",
          properties: {
            appId: { type: "integer" },
            gameName: { type: "string" },
            language: { type: "string" },
            dayRange: { type: "integer" },
            reviewType: {
              type: "string",
              enum: ["all", "positive", "negative"],
            },
            maxReviews: { type: "integer" },
          },
          required: ["appId"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "get_review_stats",
        description: "Compute deterministic review stats for a previously fetched app.",
        parameters: {
          type: "object",
          properties: {
            appId: { type: "integer" },
          },
          required: ["appId"],
          additionalProperties: false,
        },
      },
    },
    {
      type: "function" as const,
      function: {
        name: "extract_review_topics",
        description: "Extract lightweight rule-based review topics for a previously fetched app.",
        parameters: {
          type: "object",
          properties: {
            appId: { type: "integer" },
          },
          required: ["appId"],
          additionalProperties: false,
        },
      },
    },
  ];

  const systemPrompt = [
    "你是 Steam review intelligence agent。",
    "你的职责是根据用户问题，自主决定是否调用工具，收集足够证据后输出最终 JSON。",
    "规则：",
    "- 用户可能给游戏名、App ID、或者比较/诊断类问题。",
    "- 先最小化调用工具，再做结论；不要臆测未抓取到的游戏。",
    "- 优先使用 get_review_stats 和 extract_review_topics，而不是直接依赖原始评论做判断。",
    "- 如果用户要求比较两个游戏，应为两个游戏都抓取评论并分别做 stats/topics。",
    "- 所有解释性文本必须使用简体中文。",
    "- 最终必须只输出一个 JSON 对象，结构匹配 schema。",
    "- 如果证据不足，要在 executiveSummary 和 operationalInsights 里明确说明。",
    "- neutral 表示 mixed/信息不足，不要强行设高。",
    "",
    "可用 schema:",
    JSON.stringify({
      query: "string",
      mode: "single_game | comparison",
      games: [
        {
          appId: "number",
          name: "string",
          requestedReviewCount: "number",
          language: "string",
          fetchedReviewCount: "number",
          steamSummary: {
            totalReviews: "number",
            positive: "number",
            negative: "number",
            positivePct: "number",
            negativePct: "number",
          },
          stats: {
            totalReviews: "number",
            positive: "number",
            negative: "number",
            positivePct: "number",
            negativePct: "number",
            languageDistribution: [{ language: "string", count: "number" }],
            playtimeBuckets: [{ bucket: "string", count: "number" }],
            recentSentimentShift: {
              recentNegativePct: "number",
              earlierNegativePct: "number",
              deltaPct: "number",
            },
            keywordHits: [{ keyword: "string", count: "number" }],
          },
          topics: [{ name: "string", count: "number", examples: ["string"] }],
        },
      ],
      analysis: {
        overallSentiment: {
          positive: "number",
          negative: "number",
          neutral: "number",
        },
        topPositiveFeedback: [{ theme: "string", summary: "string" }],
        topComplaints: [
          {
            theme: "string",
            summary: "string",
            severity: "low | medium | high | critical",
          },
        ],
        keyPlayerConcerns: ["string"],
        representativeQuotes: ["string"],
        operationalInsights: ["string"],
        executiveSummary: "string",
      },
    }),
  ].join("\n");

  const messages: Array<Record<string, unknown>> = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: JSON.stringify({
        query: input.query,
        preferredLanguage: input.language,
        preferredReviewCount: input.count,
        explicitAppId: input.appId ?? null,
      }),
    },
  ];

  const executeTool = async (name: string, rawArgs: string) => {
    const args = rawArgs ? (JSON.parse(rawArgs) as Record<string, unknown>) : {};

    if (name === "resolve_game_to_appid") {
      const gameName = String(args.name ?? "").trim();
      return resolveGameToAppId(gameName);
    }

    if (name === "fetch_steam_reviews") {
      const appId = Number(args.appId);
      const language = String(args.language ?? input.language ?? "all");
      const maxReviews = Number(args.maxReviews ?? input.count);
      const gameName = typeof args.gameName === "string" ? args.gameName : `App ${appId}`;

      const steam = await fetchSteamReviews({
        appId,
        count: Number.isFinite(maxReviews) ? maxReviews : input.count,
        language,
        filter: "recent",
        dayRange: Number(args.dayRange ?? 365),
        reviewType:
          args.reviewType === "positive" || args.reviewType === "negative"
            ? args.reviewType
            : "all",
      });

      const game = buildGameContext({
        appId,
        name: gameName,
        requestedReviewCount: Number.isFinite(maxReviews) ? maxReviews : input.count,
        language,
        reviews: steam.reviews,
      });
      loadedGames.set(appId, { game, reviews: steam.reviews });

      return {
        appId,
        name: game.name,
        fetchedReviewCount: steam.totalReviews,
        steamSummary: game.steamSummary,
        rawQuerySummary: steam.rawQuerySummary,
      };
    }

    if (name === "get_review_stats") {
      const appId = Number(args.appId);
      const loaded = loadedGames.get(appId);
      if (!loaded) {
        throw new Error(`No fetched reviews found for app ${appId}.`);
      }
      return loaded.game.stats;
    }

    if (name === "extract_review_topics") {
      const appId = Number(args.appId);
      const loaded = loadedGames.get(appId);
      if (!loaded) {
        throw new Error(`No fetched reviews found for app ${appId}.`);
      }
      return { topics: loaded.game.topics };
    }

    throw new Error(`Unsupported tool: ${name}`);
  };

  for (let iteration = 0; iteration < 6; iteration += 1) {
    const completion = await client.chat.completions.create({
      model: config.model,
      messages: messages as never,
      tools,
      tool_choice: "auto",
      temperature: 0.2,
      response_format: { type: "json_object" },
    });

    const message = completion.choices[0]?.message;
    if (!message) {
      throw new Error(`${config.provider} returned an empty response.`);
    }

    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: message.content ?? "",
        tool_calls: toolCalls,
      });

      for (const call of toolCalls) {
        if (call.type !== "function") continue;

        try {
          const result = await executeTool(call.function.name, call.function.arguments);
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify(result),
          });
        } catch (error) {
          messages.push({
            role: "tool",
            tool_call_id: call.id,
            content: JSON.stringify({
              error: error instanceof Error ? error.message : "Tool execution failed.",
            }),
          });
        }
      }
      continue;
    }

    const content = message.content ?? "";
    const jsonText = extractJsonObject(content);
    if (!jsonText) break;

    try {
      const parsed = analysisResponseSchema.parse(JSON.parse(jsonText));
      const mergedGames = parsed.games.map((game) => loadedGames.get(game.appId)?.game ?? game);

      return {
        query: parsed.query || input.query,
        mode: mergedGames.length > 1 ? "comparison" : "single_game",
        games: mergedGames,
        analysis: parsed.analysis,
      };
    } catch {
      break;
    }
  }

  const fallbackGames = [...loadedGames.values()].map((entry) => entry.game);
  if (!fallbackGames.length && input.appId) {
    const steam = await fetchSteamReviews({
      appId: input.appId,
      count: input.count,
      language: input.language,
      filter: "recent",
    });

    fallbackGames.push(
      buildGameContext({
        appId: input.appId,
        name: `App ${input.appId}`,
        requestedReviewCount: input.count,
        language: input.language,
        reviews: steam.reviews,
      }),
    );
  }

  if (!fallbackGames.length) {
    throw new Error("Agent did not resolve any game to analyze.");
  }

  return {
    query: input.query,
    mode: fallbackGames.length > 1 ? "comparison" : "single_game",
    games: fallbackGames,
    analysis: getFallbackAnalysis(fallbackGames),
  };
}
