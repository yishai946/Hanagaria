# הנגריה — מדריכי הרכבה בתלת־ממד

Describe (or photograph) something to build from wood or metal. Claude designs it and returns a LEGO-style animated 3D booklet: parts page, step-by-step assembly, tools, cut list and expected prices from Israeli stores (via web search).

## Run

```
npm install
copy .env.example .env      # put your ANTHROPIC_API_KEY in it
npm run dev                 # http://localhost:5173
```

Production: `npm run build` then `npm start` (serves the site and API on port 8787).

A demo project ("שולחן קפה תעשייתי") works without an API key.

## Layout

TypeScript throughout, split by layer (same idea as Trace: one folder per layer, `@shared` for code both sides use).

```
server/                      API (Express, run with tsx)
  index.ts  app.ts  config.ts  errors.ts
  ai/                        client, prompts (system prompt), schemas (submit_plan tool, questions)
  modules/
    planRequest.ts           validates the browser request, builds the AI message
    plan/                    POST /api/plan: Claude + web search, SSE progress (routes + service)
    questions/               POST /api/questions: clarifying questions (routes + service)
shared/                      used by server and web
  constants.ts  types.ts     materials, difficulty/budget, Plan types
  plan.ts  demoPlan.ts       normalizes/validates the AI plan, groups parts, totals; demo project
web/                         React + Vite front-end (Hebrew RTL)
  src/App.tsx                state orchestration
  src/pages/                 home, questions, generating, project (+ side panes)
  src/components/            Icon, Brand, Seg, BgModel
  src/three/                 Viewer3D (react-three-fiber), procedural wood/metal assets
  src/api/ cloud/ lib/       server calls, Supabase accounts, storage / customize / finishes
supabase/schema.sql
```

Checks: `npm run typecheck`, `npm test` (vitest).

Settings in `.env`: `MODEL`, `EFFORT` (low/medium/high), `API_PORT`.

## Accounts (optional)

Signed-in users get their projects saved to their account; everyone else keeps saving in the browser. It uses Supabase (free tier: 50k monthly users, 500 MB; a project with no activity for a week is paused and wakes with one click).

1. Create a project at https://supabase.com and run `supabase/schema.sql` in the SQL Editor.
2. Authentication → Providers: email is on by default (magic link); enable Google if you want it (needs a Google OAuth client).
3. Authentication → URL Configuration: add your site URL (and `http://localhost:5173`) to the allowed redirect URLs.
4. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` and rebuild (`npm run build`).
