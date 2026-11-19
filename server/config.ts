export const PORT = Number(process.env.API_PORT) || 8787;
export const MODEL = process.env.MODEL || 'claude-opus-5-5';
export const EFFORT = (process.env.EFFORT || 'high') as 'low' | 'medium' | 'high' | 'xhigh' | 'max';
