import { Router } from 'express';
import { friendlyError } from '../../errors';
import { parseRequest } from '../planRequest';
import { generateQuestions } from './questions.service';

export const questionsRoutes = Router();

questionsRoutes.post('/questions', async (req, res) => {
  const r = parseRequest(req.body);
  if ('error' in r) return void res.status(400).json({ error: r.error });
  try {
    const questions = await generateQuestions(r);
    if (!questions) return void res.status(422).json({ error: 'הבקשה נדחתה. נסה לנסח אחרת.' });
    res.json(questions);
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: friendlyError(err) });
  }
});
