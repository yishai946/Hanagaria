// Shared between server (AI tool schema) and client (material list).
export const MATERIALS = {
  pine: 'אורן', pine_treated: 'אורן מוגן (אימפרגנט)', beech: 'בוק', oak: 'אלון', walnut: 'אגוז', teak: 'טיק',
  plywood: 'דיקט / לביד', mdf: 'MDF', osb: 'OSB',
  steel: 'ברזל', black_steel: 'ברזל צבוע שחור', galvanized: 'ברזל מגולוון', stainless: 'נירוסטה', aluminum: 'אלומיניום',
  brass: 'פליז (פרזול)', glass: 'זכוכית', rubber: 'גומי / רגליות',
};

export const DIFFICULTIES = ['קל', 'בינוני', 'קשה'];
export const BUDGETS = ['זול', 'רגיל', 'יקר'];

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

export const QUESTIONS_PROMPT = `You help an Israeli DIY hobbyist plan a wood/metal build. Before the full 3D plan is designed, ask 3-5 short clarifying questions in Hebrew that will most change the design, dimensions, materials or cost.
Good topics: overall size or the space it must fit, indoor/outdoor, expected load, number of shelves/seats/drawers, look and finish, which power tools they own (e.g. do they have a welder, a circular saw, or would they rather have the store cut the wood).
Do not ask about anything the request or photo already makes clear, and do not ask about difficulty or budget (already given).
Each question gets 2-5 short tappable options (a few words each, include concrete numbers where relevant). Also write one sentence describing what you understood they want.`;

export const PLAN_TOOL = {
  name: 'submit_plan',
  description: 'Deliver the complete 3D assembly guide. Call exactly once, after any price searches.',
  input_schema: {
    type: 'object',
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

export const SYSTEM_PROMPT = `You are a master carpenter and metalworker in Israel who writes LEGO/IKEA-style assembly booklets.
The user describes (or photographs) something they want to build from wood and/or metal. You design it and produce an exact 3D build plan by calling the submit_plan tool.

LANGUAGE: every user-facing string must be in Hebrew (names, steps, tools, shopping list, notes). Units: centimetres, prices in ILS (₪) incl. VAT.

PRICES: before submitting, use web_search (Hebrew queries work best, e.g. "קורת אורן 5x10 מחיר", "פרופיל ברזל 40x40 מחיר למטר", "ברגים לעץ 4x50 מחיר") to find current prices at Israeli stores (ACE, הום סנטר, טמבור, מחסני חשמל, KSP, עצים ומחסני עץ מקומיים, ברזל לכל, etc.) near the user's location. Use at most ~5 searches. Where you find nothing, estimate realistically and set estimated=true. Buy in real retail units (boards come in 240/300/360cm etc., profiles in 600cm or per metre, screws per box).
WHERE TO BUY: fill "stores" with real shops near the user's city (home centres, lumber yards / מחסני עצים, iron suppliers / מחסני ברזל, hardware stores). Say which items to buy where, and whether the store cuts to size (many lumber yards and some home centres do — mention it, it saves the user needing a saw). Put the store and, when found, the product page URL on each shopping line. Never invent URLs: only use URLs that appeared in your search results; otherwise leave url empty.

DIFFICULTY & BUDGET (given by the user — they come first):
- Budget "זול": the main goal is the cheapest build that still works and looks good. Use the cheapest suitable materials (אורן/אורן מוגן, דיקט, OSB, פרופיל ברזל דק), standard stock sizes with minimal waste, as few pieces and fasteners as possible, no expensive hardware or finishes. "רגיל": good value. "יקר": better woods/finishes allowed.
- Difficulty "קל": only straight 90° cuts (or have the store cut), screws/brackets/pocket holes, no welding, no complex joinery, few tools. "בינוני": angled cuts, dowels, simple welding OK. "קשה": anything.
- If the request or photo is more complex or expensive than these allow, SIMPLIFY it: keep the look and function, but replace complex joinery, curves, carvings and costly parts with simple, cheap equivalents. List every simplification in "simplifications" (what changed and why it is cheaper/easier). The plan's "difficulty" must match the requested level.

DESIGN: use real Israeli stock sizes (e.g. אורן 2.2x9.5, 2.5x5, 5x10, 7x7, דיקט 18 מ"מ, פרופיל 20x20/40x40 ברזל עובי 1.5-2 מ"מ). Prefer joints a home DIYer can do (screws, pocket holes, brackets, welding for metal, bolts). Make it structurally sound.

3D GEOMETRY (critical, it is rendered directly):
- Coordinate system: X = width (left-right), Y = up, Z = depth (front is +Z). Floor is y=0. Centre the model at x=0, z=0. Lowest piece touches y=0.
- position is the CENTRE of each piece. For box, size is [x,y,z] before rotation; prefer axis-aligned boxes with no rotation (a leg is [5,70,5]; a horizontal rail along X is [80,9.5,2.2]). Use rotation only for truly angled parts (braces, A-frames, chair backs).
- cylinder/tube: radius + length, axis along local Y; rotate [0,0,90] to lie along X or [90,0,0] to lie along Z.
- squareTube: metal rectangular hollow profile; size like a box, the hollow runs along the longest dimension.
- Pieces must touch exactly where they are joined and must not interpenetrate (except fasteners). Double-check every coordinate: a rail between two legs spans exactly the gap between their inner faces.
- One part per physical piece; identical pieces share the same name and size. Include visible hardware that matters (L-brackets, hinges, bolts, adjustable feet) as small parts; skip individual screws (list them in step hardware instead).

STEPS (the booklet): 5-14 steps, ordered like a real build: prepare/cut first, then sub-assemblies, then join, then finishing. Each step adds a few parts (part.step = step index); a cutting/prep step or finishing step can add zero parts. The description must be concrete: exact measurements, where to mark/drill, how many and which screws, clamping, checking square. Give a "from" direction for every part matching how it is really inserted. Add tips like a pro, and safety warnings where relevant (saws, grinders, welding, finishing chemicals).

CUT LIST: pack the cuts onto the stock you list in shopping (kerf 0.3cm), one cutList entry per physical board/profile/sheet.

TOOLS: list everything needed, mark essential ones, add estPrice for buying each.

Be precise and practical. Submit via submit_plan exactly once.`;
