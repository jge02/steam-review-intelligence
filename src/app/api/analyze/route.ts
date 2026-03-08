import { NextResponse } from "next/server";
import { runReviewAgent } from "@/lib/openai";
import type { AnalysisResponse } from "@/types/analysis";
import type { LlmProvider } from "@/lib/openai";

export const runtime = "nodejs";

type AnalyzeRequestBody = {
  query?: string;
  appId?: string | number;
  count?: number;
  language?: string;
  llmProvider?: LlmProvider;
  llmModel?: string;
};

function asInt(v: unknown) {
  const n = typeof v === "string" ? Number(v) : (v as number);
  return Number.isFinite(n) ? Math.floor(n) : NaN;
}

export async function POST(req: Request) {
  let body: AnalyzeRequestBody;
  try {
    body = (await req.json()) as AnalyzeRequestBody;
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON request body." },
      { status: 400 },
    );
  }

  const appId = body.appId === undefined ? NaN : asInt(body.appId);
  const query =
    typeof body.query === "string" && body.query.trim().length
      ? body.query.trim()
      : Number.isInteger(appId) && appId > 0
        ? `分析 Steam App ${appId} 的近期评论`
        : "";
  const requestedCount = asInt(body.count ?? 100);
  const count = Number.isFinite(requestedCount)
    ? Math.max(1, Math.min(300, requestedCount))
    : 100;
  const language =
    typeof body.language === "string" && body.language.trim().length
      ? body.language.trim().toLowerCase()
      : "all";
  const llmProvider: LlmProvider =
    body.llmProvider === "openai" || body.llmProvider === "openai_compatible"
      ? body.llmProvider
      : "openai";
  const llmModel =
    typeof body.llmModel === "string" && body.llmModel.trim().length
      ? body.llmModel.trim()
      : undefined;

  if (!query && (!Number.isInteger(appId) || appId <= 0)) {
    return NextResponse.json(
      { error: "Please provide a natural-language query or a valid Steam App ID." },
      { status: 400 },
    );
  }

  try {
    const payload = await runReviewAgent({
      query,
      appId: Number.isInteger(appId) && appId > 0 ? appId : undefined,
      language,
      count,
      llm: {
        provider: llmProvider,
        model: llmModel,
      },
    });

    return NextResponse.json(payload satisfies AnalysisResponse);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    const status =
      message.includes("Steam API") || message.includes("reviews")
        ? 502
        : message.includes("resolve any game")
          ? 404
        : message.includes("API_KEY") ||
            message.includes("BASE_URL") ||
            message.includes("OpenAI") ||
            message.includes("provider")
          ? 502
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
