import { Router } from 'express';
import { friendlyError } from '../../errors';
import { parseRequest } from '../planRequest';
import { generatePlan } from './plan.service';

export const planRoutes = Router();

// Server-sent events: status/progress while the AI works, then `done` with the plan (or `error`).
planRoutes.post('/plan', async (req, res) => {
  const r = parseRequest(req.body);
  if ('error' in r) return void res.status(400).json({ error: r.error });

  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  const send = (event: string, data: unknown) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  const abort = new AbortController();
  res.on('close', () => abort.abort());

  try {
    send('done', await generatePlan(r, send, abort.signal));
  } catch (err) {
    if (!abort.signal.aborted) {
      console.error(err);
      send('error', { message: friendlyError(err) });
    }
  }
  res.end();
});
