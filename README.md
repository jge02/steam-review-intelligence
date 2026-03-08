## Steam Review Intelligence

Internal tool for game publishing/operations teams: ask a natural-language question, let the backend agent resolve games, fetch Steam reviews, compute deterministic stats/topics, and generate a structured AI analysis dashboard.

### Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Server-side review intelligence agent with tool calling
- Steam + LLM backend (DeepSeek / OpenAI / OpenAI-compatible, API key stays server-side)
- Simple local JSON cache in `.cache/`

### Folder structure

```
steam-review-intelligence/
  src/
    app/
      api/
        analyze/
          route.ts
      layout.tsx
      page.tsx
      globals.css
    components/
      Card.tsx
      Field.tsx
      ReviewAnalyzer.tsx
    lib/
      cache.ts
      openai.ts
      review-analysis.ts
      steam.ts
    types/
      analysis.ts
      steam.ts
  .env.example
```

### Setup

1) Install deps

```bash
npm install
```

2) Configure env vars

```bash
copy .env.example .env.local
```

Then edit `.env.local` and set at least one provider:
- `DEEPSEEK_API_KEY=...` (DeepSeek)
- `OPENAI_API_KEY=...` (OpenAI / ChatGPT)
- `OPENAI_COMPAT_API_KEY=...` + `OPENAI_COMPAT_BASE_URL=...` (OpenAI-compatible API)

3) Run dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

### Agent workflow

The current backend is no longer a fixed one-shot pipeline. The model can call these tools on demand:

- `resolve_game_to_appid(name)`
- `fetch_steam_reviews({ appId, language, dayRange, reviewType, maxReviews })`
- `get_review_stats(appId)`
- `extract_review_topics(appId)`

Typical queries:

- `帮我找最近差评暴涨的原因`
- `比较 Monster Hunter Wilds 和 Helldivers 2 的近期差评`
- `这个游戏值不值得发行团队优先修 UI 还是性能问题`

### Notes / constraints

- Steam reviews are fetched via `store.steampowered.com/appreviews/{appId}`.
- Game name resolution uses Steam store search.
- Review fetches and game resolution results are cached to `.cache/`.
- `get_review_stats` and `extract_review_topics` are deterministic local analysis steps, so the model reasons over aggregated evidence instead of raw comments only.
- The final dashboard response stays structured JSON, and the orchestration path is implemented directly with the OpenAI SDK tool-calling loop.
