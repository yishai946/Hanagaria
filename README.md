# סדנה — מדריכי הרכבה בתלת־ממד

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

- `server.js` — `/api/plan`: Claude (`claude-opus-5-5`) + web search → plan via the `submit_plan` tool, streamed progress (SSE).
- `src/planSchema.js` — the plan JSON schema and the system prompt (geometry rules, Hebrew, prices).
- `src/plan.js` — validates/normalizes the AI plan, groups identical parts (letters א, ב...), totals.
- `src/Viewer3D.jsx`, `src/threeAssets.js` — React Three Fiber scene, procedural wood/metal, animations.
- `src/App.jsx` — Hebrew RTL UI. Projects are saved in the browser (localStorage).

Settings in `.env`: `MODEL`, `EFFORT` (low/medium/high), `API_PORT`.

## Accounts (optional)

Signed-in users get their projects saved to their account; everyone else keeps saving in the browser. It uses Supabase (free tier: 50k monthly users, 500 MB; a project with no activity for a week is paused and wakes with one click).

1. Create a project at https://supabase.com and run `supabase/schema.sql` in the SQL Editor.
2. Authentication → Providers: email is on by default (magic link); enable Google if you want it (needs a Google OAuth client).
3. Authentication → URL Configuration: add your site URL (and `http://localhost:5173`) to the allowed redirect URLs.
4. Put `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` and rebuild (`npm run build`).
