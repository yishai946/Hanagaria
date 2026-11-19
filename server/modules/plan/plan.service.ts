// Claude + web search -> a full 3D build plan, reporting progress through `send`.
import type { PlanRequestBody, RawPlan } from '@shared/types';
import { getClient } from '../../ai/client';
import { SYSTEM_PROMPT } from '../../ai/prompts';
import { PLAN_TOOL } from '../../ai/schemas';
import { EFFORT, MODEL } from '../../config';
import { userContent } from '../planRequest';

export type Send = (event: string, data: unknown) => void;

export async function generatePlan(r: PlanRequestBody, send: Send, signal: AbortSignal): Promise<RawPlan> {
  const client = getClient();
  const { prompt, image, city, difficulty, budget, answers } = r;
  const messages: any[] = [{ role: 'user', content: userContent(r) }];
  const sources = new Map<string, string>();
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
    stream.on('contentBlock', (block: any) => {
      if (block.type === 'server_tool_use' && block.name === 'web_search') send('status', { stage: 'search', text: `מחפש: ${block.input?.query ?? ''}` });
      if (block.type === 'web_search_tool_result' && Array.isArray(block.content))
        for (const hit of block.content) if (hit.url && sources.size < 12) sources.set(hit.url, hit.title || hit.url);
    });
    stream.on('streamEvent', (ev: any) => {
      if (ev.type === 'content_block_start' && ev.content_block.type === 'tool_use') send('status', { stage: 'write', text: 'כותב את חוברת ההרכבה...' });
    });
    stream.on('inputJson', (_partial: string, snap: any) => {
      const now = Date.now();
      if (now - lastProgress < 400 || !snap || typeof snap !== 'object' || 'query' in snap) return; // skip web_search inputs
      lastProgress = now;
      send('progress', { parts: snap.parts?.length || 0, steps: snap.steps?.length || 0, title: snap.title || '' });
    });

    const msg = await stream.finalMessage();
    if (msg.stop_reason === 'refusal') throw new Error('הבקשה נדחתה על ידי מערכת הבטיחות. נסה לנסח אחרת.');
    if (msg.stop_reason === 'max_tokens') throw new Error('התוכנית יצאה ארוכה מדי. נסה פרויקט פשוט יותר או פרט פחות.');

    const call = msg.content.find((b: any) => b.type === 'tool_use' && b.name === PLAN_TOOL.name) as { input: any } | undefined;
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
