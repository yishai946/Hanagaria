import Anthropic from '@anthropic-ai/sdk';

export function friendlyError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return 'מפתח ה-API לא תקין. בדוק את ANTHROPIC_API_KEY בקובץ .env';
  if (err instanceof Anthropic.RateLimitError) return 'יותר מדי בקשות כרגע. נסה שוב בעוד דקה.';
  if (err instanceof Anthropic.APIConnectionError) return 'אין חיבור לשרת ה-AI. בדוק את החיבור לאינטרנט.';
  if (err instanceof Anthropic.APIError && err.status) return `שגיאת שרת AI (${err.status}). נסה שוב.`;
  const message = err instanceof Error ? err.message : '';
  if (/credentials|apiKey|API key/i.test(message)) return 'חסר מפתח API. הוסף ANTHROPIC_API_KEY לקובץ .env והפעל מחדש.';
  return message || 'שגיאה לא צפויה';
}
