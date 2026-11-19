// API server entry: turns a request (text and/or photo) into a full 3D build plan with Claude + web search for local prices.
import { buildApp } from './app';
import { EFFORT, MODEL, PORT } from './config';

buildApp().listen(PORT, () => console.log(`API ready on http://localhost:${PORT}  (model ${MODEL}, effort ${EFFORT})`));
