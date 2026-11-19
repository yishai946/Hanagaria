// Browser side of the AI call: shrink the photo, POST, read the server-sent events.
import type { Answer, Budget, Difficulty, ImageMediaType, PlanEvent, Questions, RawPlan } from '@shared/types';

export interface UploadedImage { mediaType: ImageMediaType; data: string; preview: string }

/** What the form collects; the image keeps its preview for the UI. */
export interface PlanRequest {
  prompt: string;
  image: UploadedImage | null;
  city: string;
  difficulty: Difficulty;
  budget: Budget;
  answers?: Answer[];
}

export async function fileToImage(file: File, max = 1568): Promise<UploadedImage> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  const url = c.toDataURL('image/jpeg', 0.88);
  return { mediaType: 'image/jpeg', data: url.split(',')[1]!, preview: url };
}

const body = ({ prompt, image, city, difficulty, budget, answers }: PlanRequest) =>
  JSON.stringify({ prompt, city, difficulty, budget, answers, image: image ? { mediaType: image.mediaType, data: image.data } : undefined });

export async function requestQuestions(req: PlanRequest, signal: AbortSignal): Promise<Questions> {
  const res = await fetch('/api/questions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal, body: body(req) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(j.error || `השרת לא זמין (${res.status})`);
  return { understanding: typeof j.understanding === 'string' ? j.understanding : '', questions: Array.isArray(j.questions) ? j.questions.slice(0, 6) : [] };
}

export async function requestPlan(req: PlanRequest, onEvent: (e: PlanEvent) => void, signal: AbortSignal): Promise<RawPlan> {
  const res = await fetch('/api/plan', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, signal,
    body: body(req),
  });
  if (!res.ok || !res.body) {
    const j = await res.json().catch(() => ({}));
    throw new Error(j.error || `השרת לא זמין (${res.status}). האם הפעלת את npm run dev?`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = '';
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value;
    let i: number;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const ev = /^event: (.+)$/m.exec(chunk)?.[1];
      const data = /^data: (.*)$/m.exec(chunk)?.[1];
      if (!ev || data == null) continue;
      const payload = JSON.parse(data);
      if (ev === 'error') throw new Error(payload.message);
      if (ev === 'done') return payload;
      onEvent({ event: ev, data: payload } as PlanEvent);
    }
  }
  throw new Error('החיבור לשרת נקטע לפני שהתוכנית הושלמה.');
}
