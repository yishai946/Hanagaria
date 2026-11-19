import Anthropic from '@anthropic-ai/sdk';

let client: Anthropic | undefined;

/** Created on first use so the server starts (and the demo works) without an API key. */
export const getClient = () => (client ??= new Anthropic());
