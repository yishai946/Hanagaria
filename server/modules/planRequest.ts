// Trust boundary: validate everything that comes from the browser, then turn it into the AI's user message.
import type Anthropic from '@anthropic-ai/sdk';
import { BUDGETS, DIFFICULTIES, IMAGE_TYPES } from '@shared/constants';
import type { PlanRequestBody } from '@shared/types';

export function parseRequest(body: unknown): PlanRequestBody | { error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, any>;
  const { prompt = '', image, city = '', difficulty = 'קל', budget = 'זול', answers = [] } = b;
  if (typeof prompt !== 'string' || prompt.length > 4000) return { error: 'תיאור לא תקין' };
  if (!prompt.trim() && !image) return { error: 'צריך תיאור או תמונה' };
  if (image && (!(IMAGE_TYPES as readonly string[]).includes(image.mediaType) || typeof image.data !== 'string' || image.data.length > 12e6)) return { error: 'פורמט תמונה לא נתמך' };
  if (typeof city !== 'string' || city.length > 60) return { error: 'עיר לא תקינה' };
  if (!DIFFICULTIES.includes(difficulty) || !BUDGETS.includes(budget)) return { error: 'רמת קושי או תקציב לא תקינים' };
  if (!Array.isArray(answers) || answers.length > 10 || !answers.every((a) => typeof a?.q === 'string' && typeof a?.a === 'string' && a.q.length < 300 && a.a.length < 500))
    return { error: 'תשובות לא תקינות' };
  return { prompt: prompt.trim(), image, city: city.trim(), difficulty, budget, answers };
}

export function userContent({ prompt, image, city, difficulty, budget, answers }: PlanRequestBody): Anthropic.Beta.BetaContentBlockParam[] {
  const lines = [
    `${image ? 'מצורפת תמונה של הפריט שאני רוצה לבנות. ' : ''}${prompt || 'בנה לי את מה שבתמונה.'}`,
    `רמת קושי רצויה: ${difficulty}. תקציב: ${budget}.`,
    `מיקום לחיפוש חנויות ומחירים: ${city || 'ישראל'}`,
  ];
  if (answers.length) lines.push('תשובות לשאלות ההבהרה:', ...answers.map((x) => `- ${x.q} → ${x.a}`));
  return [
    ...(image ? [{ type: 'image' as const, source: { type: 'base64' as const, media_type: image.mediaType, data: image.data } }] : []),
    { type: 'text', text: lines.join('\n') },
  ];
}
