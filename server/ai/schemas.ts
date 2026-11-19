// JSON schemas the AI fills in: the clarifying questions and the submit_plan tool.
import { DIFFICULTIES, MATERIALS } from '@shared/constants';

export const QUESTIONS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['understanding', 'questions'],
  properties: {
    understanding: { type: 'string', description: 'Hebrew, one sentence: what you understood they want' },
    questions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['question', 'options'],
        properties: { question: { type: 'string' }, options: { type: 'array', items: { type: 'string' } } },
      },
    },
  },
};

export const PLAN_TOOL = {
  name: 'submit_plan',
  description: 'Deliver the complete 3D assembly guide. Call exactly once, after any price searches.',
  input_schema: {
    type: 'object' as const,
    required: ['title', 'summary', 'difficulty', 'timeHours', 'dimensions', 'parts', 'steps', 'tools', 'shopping', 'cutList', 'stores'],
    properties: {
      title: { type: 'string', description: 'Hebrew project name' },
      summary: { type: 'string', description: 'Hebrew, 1-2 sentences' },
      difficulty: { type: 'string', enum: DIFFICULTIES },
      timeHours: { type: 'number' },
      dimensions: {
        type: 'object', required: ['width', 'height', 'depth'],
        properties: { width: { type: 'number' }, height: { type: 'number' }, depth: { type: 'number' } },
      },
      parts: {
        type: 'array',
        description: 'Every physical piece (including visible hardware such as brackets, bolts, feet). Centimetres, Y is up, floor is y=0, model centred on x=0,z=0.',
        items: {
          type: 'object',
          required: ['id', 'name', 'shape', 'material', 'position', 'step'],
          properties: {
            id: { type: 'string' },
            name: { type: 'string', description: 'Hebrew, short, identical for identical pieces (e.g. "רגל")' },
            shape: { type: 'string', enum: ['box', 'cylinder', 'tube', 'squareTube'] },
            size: { type: 'array', items: { type: 'number' }, description: 'box/squareTube: [x,y,z] outer size in cm, axis-aligned BEFORE rotation' },
            radius: { type: 'number', description: 'cylinder/tube: outer radius cm' },
            length: { type: 'number', description: 'cylinder/tube: length along local Y before rotation' },
            wall: { type: 'number', description: 'tube/squareTube wall thickness cm (e.g. 0.15)' },
            position: { type: 'array', items: { type: 'number' }, description: '[x,y,z] centre of the piece in assembled state' },
            rotation: { type: 'array', items: { type: 'number' }, description: '[x,y,z] degrees, XYZ order. Omit when 0.' },
            material: { type: 'string', enum: Object.keys(MATERIALS) },
            color: { type: 'string', description: 'optional hex for paint/finish' },
            step: { type: 'integer', description: '0-based index of the step that installs this piece' },
            from: { type: 'array', items: { type: 'number' }, description: 'direction in cm the piece slides in from (e.g. [0,40,0] = dropped from above). Choose the real assembly motion.' },
          },
        },
      },
      steps: {
        type: 'array',
        items: {
          type: 'object',
          required: ['title', 'description', 'tools'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string', description: 'Hebrew, precise: measurements, where to drill, how many screws, order of actions' },
            tools: { type: 'array', items: { type: 'string' } },
            hardware: {
              type: 'array',
              items: { type: 'object', required: ['name', 'qty'], properties: { name: { type: 'string' }, qty: { type: 'integer' } } },
            },
            tip: { type: 'string' },
            warning: { type: 'string', description: 'safety note if relevant' },
            finish: { type: 'boolean', description: 'true for sanding/painting/finishing steps' },
          },
        },
      },
      tools: {
        type: 'array',
        items: {
          type: 'object', required: ['name', 'purpose'],
          properties: {
            name: { type: 'string' }, purpose: { type: 'string' },
            essential: { type: 'boolean' }, estPrice: { type: 'number', description: 'ILS to buy, if someone lacks it' },
          },
        },
      },
      shopping: {
        type: 'array',
        description: 'Everything to buy, with real Israeli prices found by search when possible.',
        items: {
          type: 'object', required: ['item', 'qty', 'unitPrice'],
          properties: {
            item: { type: 'string' }, spec: { type: 'string' }, qty: { type: 'number' }, unit: { type: 'string' },
            unitPrice: { type: 'number', description: 'ILS incl. VAT' }, store: { type: 'string' }, url: { type: 'string' },
            estimated: { type: 'boolean', description: 'true if price is your estimate rather than found online' },
          },
        },
      },
      cutList: {
        type: 'array',
        description: 'One entry per physical stock board/profile/sheet to buy, with the cuts packed onto it (kerf 0.3cm).',
        items: {
          type: 'object', required: ['stock', 'stockLength', 'cuts'],
          properties: {
            stock: { type: 'string', description: 'e.g. "קורת אורן 5x10 ס״מ"' },
            stockLength: { type: 'number' }, stockWidth: { type: 'number', description: 'sheets only' },
            cuts: {
              type: 'array',
              items: {
                type: 'object', required: ['name', 'length'],
                properties: { name: { type: 'string' }, length: { type: 'number' }, width: { type: 'number' }, angle: { type: 'number', description: 'miter angle in degrees if not 90' } },
              },
            },
          },
        },
      },
      priceNote: { type: 'string', description: 'Hebrew note on where prices came from' },
      stores: {
        type: 'array',
        description: 'Real stores near the user where the materials can be bought (2-6). Only real businesses found by search.',
        items: {
          type: 'object', required: ['name', 'sells'],
          properties: {
            name: { type: 'string', description: 'e.g. "ACE סניף ראשון לציון"' },
            location: { type: 'string', description: 'city / address if known' },
            url: { type: 'string', description: 'page found in search results only; omit if none' },
            sells: { type: 'string', description: 'which items of this project to buy there' },
            cutService: { type: 'boolean', description: 'true if the store cuts wood/metal to size (חיתוך לפי מידה)' },
            note: { type: 'string', description: 'e.g. price of the cutting service, opening hours caveat' },
          },
        },
      },
      simplifications: { type: 'array', items: { type: 'string' }, description: 'Hebrew: what you simplified vs the request/photo to make it cheaper or easier, and what it saves' },
    },
  },
};
