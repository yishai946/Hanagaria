// Quick clarifying questions before the long, costly plan generation.
import type { PlanRequestBody, Questions } from '@shared/types';
import { getClient } from '../../ai/client';
import { QUESTIONS_PROMPT } from '../../ai/prompts';
import { QUESTIONS_SCHEMA } from '../../ai/schemas';
import { MODEL } from '../../config';
import { userContent } from '../planRequest';

/** Returns null when the model refused. */
export async function generateQuestions(r: PlanRequestBody): Promise<Questions | null> {
  const msg = await getClient().beta.messages.create({
    model: MODEL,
    max_tokens: 8000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: { type: 'json_schema', schema: QUESTIONS_SCHEMA } },
    system: QUESTIONS_PROMPT,
    messages: [{ role: 'user', content: userContent(r) }],
  });
  if (msg.stop_reason === 'refusal') return null;
  const text = msg.content.find((b) => b.type === 'text');
  return JSON.parse(text && 'text' in text ? text.text : '{}');
}
