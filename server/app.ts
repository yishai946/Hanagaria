import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { planRoutes } from './modules/plan/plan.routes';
import { questionsRoutes } from './modules/questions/questions.routes';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');

export function buildApp() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use('/api', questionsRoutes, planRoutes);

  // Production: serve the built front-end from the same server.
  app.use(express.static(dist));
  app.get(/^(?!\/api).*/, (_req, res) => void res.sendFile(path.join(dist, 'index.html')));
  return app;
}
