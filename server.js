// API server: turns a request (text and/or photo) into a full 3D build plan with Claude + web search for local prices.
import express from 'express';
import Anthropic from '@anthropic-ai/sdk';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM_PROMPT, PLAN_TOOL, QUESTIONS_PROMPT, QUESTIONS_SCHEMA, DIFFICULTIES, BUDGETS } from './src/planSchema.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.API_PORT) || 8787;
const MODEL = process.env.MODEL || 'claude-opus-5-5';
const EFFORT = process.env.EFFORT || 'high';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

let client;
const app = express();
app.use(express.json({ limit: '15mb' }));

// Trust boundary: validate everything that comes from the browser.
function parseRequest(body) {
  const { prompt = '', image, city = '', difficulty = 'קל', budget = 'זול', answers = [] } = body || {};
  if (typeof prompt !== 'string' || prompt.length > 4000) return { error: 'תיאור לא תקין' };
  if (!prompt.trim() && !image) return { error: 'צריך תיאור או תמונה' };
  if (image && (!IMAGE_TYPES.has(image.mediaType) || typeof image.data !== 'string' || image.data.length > 12e6)) return { error: 'פורמט תמונה לא נתמך' };
  if (typeof city !== 'string' || city.length > 60) return { error: 'עיר לא תקינה' };
  if (!DIFFICULTIES.includes(difficulty) || !BUDGETS.includes(budget)) return { error: 'רמת קושי או תקציב לא תקינים' };
  if (!Array.isArray(answers) || answers.length > 10 || !answers.every((a) => typeof a?.q === 'string' && typeof a?.a === 'string' && a.q.length < 300 && a.a.length < 500))
    return { error: 'תשובות לא תקינות' };
  return { prompt: prompt.trim(), image, city: city.trim(), difficulty, budget, answers };
}

function userContent({ prompt, image, city, difficulty, budget, answers }) {
  const lines = [
    `${image ? 'מצורפת תמונה של הפריט שאני רוצה לבנות. ' : ''}${prompt || 'בנה לי את מה שבתמונה.'}`,
    `רמת קושי רצויה: ${difficulty}. תקציב: ${budget}.`,
    `מיקום לחיפוש חנויות ומחירים: ${city || 'ישראל'}`,
  ];
  if (answers.length) lines.push('תשובות לשאלות ההבהרה:', ...answers.map((x) => `- ${x.q} → ${x.a}`));
  return [
    ...(image ? [{ type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } }] : []),
    { type: 'text', text: lines.join('\n') },
  ];
}

// Quick clarifying questions before the long, costly plan generation.
app.post('/api/questions', async (req, res) => {
  const r = parseRequest(req.body);
  if (r.error) return res.status(400).json({ error: r.error });
  try {
    client ??= new Anthropic();
    const msg = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: { type: 'json_schema', schema: QUESTIONS_SCHEMA } },
      system: QUESTIONS_PROMPT,
      messages: [{ role: 'user', content: userContent(r) }],
    });
    if (msg.stop_reason === 'refusal') return res.status(422).json({ error: 'הבקשה נדחתה. נסה לנסח אחרת.' });
    res.json(JSON.parse(msg.content.find((b) => b.type === 'text')?.text ?? '{}'));
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: friendlyError(err) });
  }
});

app.post('/api/plan', async (req, res) => {
  const r = parseRequest(req.body);
  if (r.error) return res.status(400).json({ error: r.error });

  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  try {
    const plan = await generatePlan(r, send, abort.signal);
    send('done', plan);
  } catch (err) {
    if (!abort.signal.aborted) {
      console.error(err);
      send('error', { message: friendlyError(err) });
    }
  }
  res.end();
});

function friendlyError(err) {
  if (err instanceof Anthropic.AuthenticationError) return 'מפתח ה-API לא תקין. בדוק את ANTHROPIC_API_KEY בקובץ .env';
  if (err instanceof Anthropic.RateLimitError) return 'יותר מדי בקשות כרגע. נסה שוב בעוד דקה.';
  if (err instanceof Anthropic.APIConnectionError) return 'אין חיבור לשרת ה-AI. בדוק את החיבור לאינטרנט.';
  if (err instanceof Anthropic.APIError && err.status) return `שגיאת שרת AI (${err.status}). נסה שוב.`;
  if (/credentials|apiKey|API key/i.test(String(err?.message))) return 'חסר מפתח API. הוסף ANTHROPIC_API_KEY לקובץ .env והפעל מחדש.';
  return err?.message || 'שגיאה לא צפויה';
}

async function generatePlan(r, send, signal) {
  client ??= new Anthropic();
  const { prompt, image, city, difficulty, budget, answers } = r;
  const messages = [{ role: 'user', content: userContent(r) }];
  const sources = new Map();
  send('status', { stage: image ? 'image' : 'think', text: image ? 'מנתח את התמונה...' : 'מתכנן את המבנה...' });

  for (let turn = 0; turn < 6; turn++) {
    const stream = client.beta.messages.stream(
      {
        model: MODEL,
        max_tokens: 64000,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
        output_config: { effort: EFFORT },
        system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
        tools: [
          {
            type: 'web_search_20260209',
            name: 'web_search',
            max_uses: 8,
            // No user_location: the API rejects country "IL". The city goes in the prompt and the system prompt targets Israeli stores.
          },
          { ...PLAN_TOOL, eager_input_streaming: true },
        ],
        tool_choice: { type: 'auto' },
        messages,
      },
      { signal },
    );

    let lastProgress = 0;
    stream.on('contentBlock', (block) => {
      if (block.type === 'server_tool_use' && block.name === 'web_search') send('status', { stage: 'search', text: `מחפש: ${block.input?.query ?? ''}` });
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content))
        for (const r of block.content) if (r.url && sources.size < 12) sources.set(r.url, r.title || r.url);
    });
    stream.on('streamEvent', (ev) => {
      if (ev.type === 'content_block_start' && ev.content_block.type === 'tool_use') send('status', { stage: 'write', text: 'כותב את חוברת ההרכבה...' });
    });
    stream.on('inputJson', (_partial, snap) => {
      const now = Date.now();
      if (now - lastProgress < 400 || !snap || typeof snap !== 'object' || 'query' in snap) return; // skip web_search inputs
      lastProgress = now;
      send('progress', { parts: snap.parts?.length || 0, steps: snap.steps?.length || 0, title: snap.title || '' });
    });

    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') throw new Error('הבקשה נדחתה על ידי מערכת הבטיחות. נסה לנסח אחרת.');
    if (msg.stop_reason === 'max_tokens') throw new Error('התוכנית יצאה ארוכה מדי. נסה פרויקט פשוט יותר או פרט פחות.');

    const call = msg.content.find((b) => b.type === 'tool_use' && b.name === PLAN_TOOL.name);
    if (call) {
      const plan = call.input;
      if (!plan || typeof plan !== 'object' || !Array.isArray(plan.parts) || !Array.isArray(plan.steps))
        throw new Error('ה-AI החזיר תוכנית לא תקינה. נסה שוב.');
      plan.sources = [...sources].map(([url, title]) => ({ url, title }));
      plan.request = { prompt, city, hadImage: !!image, difficulty, budget, answers };
      return plan;
    }
    messages.push({ role: 'assistant', content: msg.content });
    // pause_turn: resend as-is and the server resumes; otherwise nudge it to deliver.
    if (msg.stop_reason !== 'pause_turn') messages.push({ role: 'user', content: `עכשיו קרא לכלי ${PLAN_TOOL.name} עם התוכנית המלאה.` });
  }
  throw new Error('ה-AI לא סיים לבנות תוכנית. נסה שוב.');
}

// Production: serve the built front-end from the same server.
app.use(express.static(path.join(here, 'dist')));
app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(path.join(here, 'dist', 'index.html')));

app.listen(PORT, () => console.log(`API ready on http://localhost:${PORT}  (model ${MODEL}, effort ${EFFORT})`));
