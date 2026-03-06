import { NextResponse } from "next/server";
import { fetchSteamReviews } from "@/lib/steam";
import { analyzeReviewsWithOpenAI } from "@/lib/openai";
import type { AnalysisResponse } from "@/types/analysis";

export const runtime = "nodejs";

type AnalyzeRequestBody = {
  appId: string | number;
  count?: number;
  language?: string;
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

  const appId = asInt(body.appId);
  const requestedCount = asInt(body.count ?? 100);
  const count = Number.isFinite(requestedCount)
    ? Math.max(1, Math.min(300, requestedCount))
    : 100;
  const language =
    typeof body.language === "string" && body.language.trim().length
      ? body.language.trim().toLowerCase()
      : "all";

  if (!Number.isInteger(appId) || appId <= 0) {
    return NextResponse.json(
      { error: "Invalid Steam App ID." },
      { status: 400 },
    );
  }

  try {
    const steam = await fetchSteamReviews({
      appId,
      count,
      language,
      filter: "recent",
    });

    if (steam.totalReviews === 0) {
      return NextResponse.json(
        { error: "No reviews found for that App ID (with the selected filters)." },
        { status: 404 },
      );
    }

    const total = steam.totalReviews;
    const positive = steam.positive;
    const negative = steam.negative;
    const positivePct = total ? Math.round((positive / total) * 1000) / 10 : 0;
    const negativePct = total ? Math.round((negative / total) * 1000) / 10 : 0;

    const analysis = await analyzeReviewsWithOpenAI({
      appId,
      language,
      stats: { total, positive, negative },
      reviews: steam.reviews,
    });

    const payload: AnalysisResponse = {
      appId,
      requestedReviewCount: count,
      language,
      fetchedReviewCount: total,
      steamSummary: {
        totalReviews: total,
        positive,
        negative,
        positivePct,
        negativePct,
      },
      analysis,
    };

    return NextResponse.json(payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error.";
    const status =
      message.includes("Steam API") || message.includes("reviews")
        ? 502
        : message.includes("OPENAI_API_KEY") || message.includes("OpenAI")
          ? 502
          : 500;

    return NextResponse.json({ error: message }, { status });
  }
}

