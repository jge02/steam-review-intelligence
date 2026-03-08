"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/Card";
import { Field, Input, Select } from "@/components/Field";
import type { AnalysisResponse } from "@/types/analysis";

type ApiError = { error: string };

function pct(n: number) {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

function SeverityBadge({ severity }: { severity: string }) {
  const label =
    severity === "critical"
      ? "严重"
      : severity === "high"
        ? "高"
        : severity === "medium"
          ? "中"
          : "低";
  const cls =
    severity === "critical"
      ? "bg-red-600 text-white"
      : severity === "high"
        ? "bg-orange-500 text-white"
        : severity === "medium"
          ? "bg-yellow-500 text-black"
          : "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {label}
    </span>
  );
}

function List({ items }: { items: string[] }) {
  if (!items.length) return <div className="text-sm text-zinc-500">无</div>;
  return (
    <ul className="space-y-2">
      {items.map((x, idx) => (
        <li
          key={`${idx}-${x.slice(0, 24)}`}
          className="rounded-xl border border-black/10 bg-white/50 px-3 py-2 text-sm text-zinc-800 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-200"
        >
          {x}
        </li>
      ))}
    </ul>
  );
}

export function ReviewAnalyzer() {
  const [query, setQuery] = useState<string>("");
  const [appId, setAppId] = useState<string>("");
  const [count, setCount] = useState<number>(100);
  const [language, setLanguage] = useState<string>("all");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResponse | null>(null);

  const canSubmit = useMemo(() => {
    const id = Number(appId);
    const hasQuery = query.trim().length > 0;
    const hasAppId = Number.isInteger(id) && id > 0;
    return (hasQuery || hasAppId) && count >= 1 && count <= 300;
  }, [appId, count, query]);

  async function onAnalyze() {
    setError(null);
    setResult(null);
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          appId: appId.trim() ? appId : undefined,
          count,
          language,
        }),
      });

      const json = (await res.json()) as AnalysisResponse | ApiError;
      if (!res.ok) {
        setError("error" in json ? json.error : "请求失败。");
        return;
      }
      setResult(json as AnalysisResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white/70 px-3 py-1 text-xs font-semibold text-zinc-700 shadow-sm backdrop-blur dark:border-white/10 dark:bg-zinc-950/50 dark:text-zinc-200">
          Review Intelligence Agent
          <span className="h-1 w-1 rounded-full bg-zinc-400" />
          自然语言问题到评论分析
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
          Steam 评论智能分析
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          直接输入自然语言问题。Agent 会按需解析游戏、抓取 Steam 评论、生成统计与主题，再给出结构化发行/运营结论。
        </p>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card title="评论分析" className="lg:col-span-1">
          <div className="space-y-4">
            <Field label="分析问题" hint="推荐">
              <Input
                placeholder="例如：比较 Monster Hunter Wilds 和 Helldivers 2 的近期差评"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </Field>

            <Field label="Steam App ID" hint="可选">
              <Input
                inputMode="numeric"
                placeholder="例如 730，可与自然语言配合"
                value={appId}
                onChange={(e) => setAppId(e.target.value)}
              />
            </Field>

            <Field label="评论数量" hint="默认 100，最多 300">
              <Input
                type="number"
                min={1}
                max={300}
                value={count}
                onChange={(e) => setCount(Number(e.target.value))}
              />
            </Field>

            <Field label="语言" hint="Steam 语言代码">
              <Select value={language} onChange={(e) => setLanguage(e.target.value)}>
                <option value="all">全部（不筛选）</option>
                <option value="english">英语</option>
                <option value="schinese">简体中文</option>
                <option value="tchinese">繁体中文</option>
                <option value="japanese">日语</option>
                <option value="koreana">韩语</option>
                <option value="spanish">西班牙语</option>
                <option value="brazilian">巴西葡萄牙语</option>
                <option value="russian">俄语</option>
                <option value="german">德语</option>
                <option value="french">法语</option>
              </Select>
            </Field>

            <button
              type="button"
              disabled={!canSubmit || loading}
              onClick={onAnalyze}
              className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-zinc-950 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white"
            >
              {loading ? "分析中..." : "开始分析"}
            </button>

            {error ? (
              <div className="rounded-xl border border-red-500/20 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            ) : null}

            <div className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              说明：Agent 在服务端 API 路由执行。你的 API 密钥（DeepSeek/OpenAI/兼容接口）不会发送到浏览器。
            </div>
          </div>
        </Card>

        <div className="lg:col-span-2">
          {!result ? (
            <Card title="结果">
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                执行一次分析后，这里会展示 agent 解析到的游戏、评论统计、主题，以及最终运营结论。
              </div>
            </Card>
          ) : (
            <div className="space-y-6">
              <Card title="任务概览">
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="text-zinc-500">用户问题：</span>
                    <span className="ml-2 text-zinc-900 dark:text-zinc-100">
                      {result.query}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500">模式：</span>
                    <span className="ml-2 font-semibold text-zinc-900 dark:text-zinc-100">
                      {result.mode === "comparison" ? "对比分析" : "单游戏分析"}
                    </span>
                  </div>
                </div>
              </Card>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                <Card title="AI 情感分布">
                  <div className="grid grid-cols-3 gap-2">
                    {(
                      [
                        ["正向", result.analysis.overallSentiment.positive, "text-emerald-600"],
                        ["负向", result.analysis.overallSentiment.negative, "text-rose-600"],
                        ["中性", result.analysis.overallSentiment.neutral, "text-zinc-600"],
                      ] as const
                    ).map(([label, val, color]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-black/10 bg-white/50 p-3 text-center dark:border-white/10 dark:bg-zinc-950/40"
                      >
                        <div className={`text-xl font-semibold ${color} dark:opacity-90`}>
                          {val}
                        </div>
                        <div className="mt-1 text-xs font-medium text-zinc-500">
                          {label}
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                {result.games.map((game) => (
                  <Card
                    key={`${game.appId}-${game.name}`}
                    title={`${game.name} (${game.appId})`}
                  >
                    <div className="space-y-5">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="rounded-xl border border-black/10 bg-white/50 p-3 dark:border-white/10 dark:bg-zinc-950/40">
                          <div className="text-zinc-500">已抓取评论</div>
                          <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
                            {game.fetchedReviewCount}
                          </div>
                        </div>
                        <div className="rounded-xl border border-black/10 bg-white/50 p-3 dark:border-white/10 dark:bg-zinc-950/40">
                          <div className="text-zinc-500">语言</div>
                          <div className="mt-1 font-semibold text-zinc-900 dark:text-zinc-100">
                            {game.language}
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-500">好评</span>
                          <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                            {game.steamSummary.positive} ({pct(game.steamSummary.positivePct)})
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-zinc-500">差评</span>
                          <span className="font-semibold text-rose-700 dark:text-rose-400">
                            {game.steamSummary.negative} ({pct(game.steamSummary.negativePct)})
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                          <div
                            className="h-full bg-emerald-500"
                            style={{ width: `${game.steamSummary.positivePct}%` }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <div>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            关键词命中
                          </div>
                          <List
                            items={game.stats.keywordHits
                              .slice(0, 6)
                              .map((item) => `${item.keyword}: ${item.count}`)}
                          />
                        </div>
                        <div>
                          <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                            Playtime Bucket
                          </div>
                          <List
                            items={game.stats.playtimeBuckets
                              .slice(0, 5)
                              .map((item) => `${item.bucket}: ${item.count}`)}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          主题归纳
                        </div>
                        <div className="space-y-3">
                          {game.topics.length ? (
                            game.topics.slice(0, 4).map((topic) => (
                              <div
                                key={`${game.appId}-${topic.name}`}
                                className="rounded-xl border border-black/10 bg-white/50 p-4 dark:border-white/10 dark:bg-zinc-950/40"
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                                    {topic.name}
                                  </div>
                                  <div className="text-xs text-zinc-500">{topic.count}</div>
                                </div>
                                <div className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                                  {topic.examples.join(" / ")}
                                </div>
                              </div>
                            ))
                          ) : (
                            <div className="text-sm text-zinc-500">未提取到明显主题。</div>
                          )}
                        </div>
                      </div>

                      <div className="rounded-xl border border-black/10 bg-white/50 p-4 text-sm text-zinc-700 dark:border-white/10 dark:bg-zinc-950/40 dark:text-zinc-300">
                        近期差评波动：{pct(game.stats.recentSentimentShift.recentNegativePct)} vs{" "}
                        {pct(game.stats.recentSentimentShift.earlierNegativePct)}，变化{" "}
                        {pct(game.stats.recentSentimentShift.deltaPct)}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              <Card title="执行摘要">
                <p className="text-sm leading-6 text-zinc-800 dark:text-zinc-200">
                  {result.analysis.executiveSummary}
                </p>
              </Card>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Card title="主要正向主题">
                  {result.analysis.topPositiveFeedback.length ? (
                    <div className="space-y-3">
                      {result.analysis.topPositiveFeedback.map((t, idx) => (
                        <div
                          key={`${idx}-${t.theme}`}
                          className="rounded-xl border border-black/10 bg-white/50 p-4 dark:border-white/10 dark:bg-zinc-950/40"
                        >
                          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                            {t.theme}
                          </div>
                          <div className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                            {t.summary}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-500">未发现明显的正向主题。</div>
                  )}
                </Card>

                <Card title="主要抱怨点">
                  {result.analysis.topComplaints.length ? (
                    <div className="space-y-3">
                      {result.analysis.topComplaints.map((t, idx) => (
                        <div
                          key={`${idx}-${t.theme}`}
                          className="rounded-xl border border-black/10 bg-white/50 p-4 dark:border-white/10 dark:bg-zinc-950/40"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                              {t.theme}
                            </div>
                            <SeverityBadge severity={t.severity} />
                          </div>
                          <div className="mt-1 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                            {t.summary}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-zinc-500">未检测到明显的抱怨点。</div>
                  )}
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <Card title="玩家核心关注点" className="lg:col-span-1">
                  <List items={result.analysis.keyPlayerConcerns} />
                </Card>
                <Card title="运营洞察" className="lg:col-span-1">
                  <List items={result.analysis.operationalInsights} />
                </Card>
                <Card title="代表性评论引用" className="lg:col-span-1">
                  <List items={result.analysis.representativeQuotes} />
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="mt-10 border-t border-black/5 pt-6 text-xs text-zinc-500 dark:border-white/10 dark:text-zinc-400">
        缓存：Steam 评论抓取结果和游戏名解析结果会缓存在本地 <code>.cache/</code>，便于重复演示时更快返回。
      </footer>
    </div>
  );
}
