import OpenAI from "openai";
import type { AnalysisResult } from "@/types/analysis";
import type { SteamReview } from "@/types/steam";

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
}

function truncate(text: string, maxChars: number) {
  const t = (text ?? "").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars - 1)}…`;
}

export type AnalyzeInput = {
  appId: number;
  language: string;
  stats: { total: number; positive: number; negative: number };
  reviews: SteamReview[];
};

/**
 * Uses DeepSeek's OpenAI-compatible chat completions API to produce a structured
 * JSON analysis matching `AnalysisResult`.
 *
 * Docs: https://api-docs.deepseek.com/zh-cn/
 */
export async function analyzeReviewsWithOpenAI(
  input: AnalyzeInput,
): Promise<AnalysisResult> {
  // Prefer DeepSeek env vars; fall back to OpenAI ones if present so you can
  // swap providers without changing code.
  const apiKey =
    process.env.DEESEEK_API_KEY ??
    process.env.DEEPSEEK_API_KEY ??
    process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Missing DEEPSEEK_API_KEY (or OPENAI_API_KEY) for review analysis.",
    );
  }

  const baseURL =
    process.env.DEEPSEEK_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    "https://api.deepseek.com";

  const client = new OpenAI({
    apiKey,
    baseURL,
  });

  // Keep the prompt stable and the payload compact to improve reliability/cost.
  const maxReviewsForModel = Math.min(input.reviews.length, 160);
  const packedReviews = input.reviews.slice(0, maxReviewsForModel).map((r) => ({
    id: r.id,
    votedUp: r.votedUp ?? null,
    playtimeForeverMinutes: r.playtimeForeverMinutes ?? null,
    receivedForFree: r.receivedForFree ?? null,
    writtenDuringEarlyAccess: r.writtenDuringEarlyAccess ?? null,
    text: truncate(r.text, 650),
  }));

  const model =
    process.env.DEEPSEEK_MODEL ||
    process.env.OPENAI_MODEL ||
    "deepseek-chat";

  const systemPrompt =
    "你是游戏发行/运营评论分析师。你需要基于大量 Steam 评论，生成可用于内部运营决策的结构化总结。\n\n规则：\n- 只能使用评论中可证实的信息。\n- 合并相似观点，不要重复罗列。\n- 优先给出可执行建议和运营风险。\n- 只包含评论中实际出现的主题。\n- representativeQuotes 必须是评论中的原文短句（可保留原语言，不要翻译）。\n- 如果证据较弱或样本较少，要明确说明。\n- 除 representativeQuotes 外，其余所有文本字段必须使用简体中文输出。\n\n选主题时可参考（但不要强行覆盖）：性能、Bug/崩溃、玩法、画面、剧情、平衡、成长系统、商业化、本地化、UI/UX、多人/网络、内容量。\n\n你必须只输出一个 JSON 对象，且严格匹配用户消息中的 targetSchema，不要添加额外字段。";

  const userPayload = {
    appId: input.appId,
    language: input.language,
    outputLanguage: "zh-CN",
    fetchedReviewCount: input.stats.total,
    localSentiment: {
      positive: input.stats.positive,
      negative: input.stats.negative,
    },
    reviews: packedReviews,
    targetSchema: {
      overallSentiment: {
        positive: "number",
        negative: "number",
        neutral: "number",
      },
      topPositiveFeedback: [
        { theme: "string", summary: "string" },
      ],
      topComplaints: [
        {
          theme: "string",
          summary: "string",
          severity: '"low" | "medium" | "high" | "critical"',
        },
      ],
      keyPlayerConcerns: ["string"],
      representativeQuotes: ["string"],
      operationalInsights: ["string"],
      executiveSummary: "string",
    },
  };

  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: JSON.stringify(userPayload),
      },
    ],
    // DeepSeek 支持 OpenAI 兼容的 JSON 输出配置
    response_format: { type: "json_object" as const },
    temperature: 0.2,
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek returned an empty response.");
  }

  try {
    return JSON.parse(content) as AnalysisResult;
  } catch {
    throw new Error("DeepSeek returned invalid JSON for analysis result.");
  }
}
