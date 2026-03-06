## Steam Review Intelligence (MVP)

Internal tool for game publishing/operations teams: enter a Steam App ID, fetch recent Steam reviews, compute basic stats, and generate a **structured** AI analysis dashboard.

### Tech stack

- Next.js (App Router) + TypeScript
- Tailwind CSS
- Server-side API route for Steam + LLM (DeepSeek-compatible, API key stays server-side)
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

Then edit `.env.local` and set `DEEPSEEK_API_KEY=...`.

3) Run dev server

```bash
npm run dev
```

Open `http://localhost:3000`.

### Notes / constraints (MVP)

- Steam reviews are fetched via the public endpoint `store.steampowered.com/appreviews/{appId}`.
- Review fetches are cached to `.cache/` keyed by (appId, language, count) to speed up repeated demos.
- AI output uses **JSON Schema structured output** (no fragile free-form parsing).

