// Pure helpers: make an AI plan safe to render, group identical parts, compute totals.
import { MATERIALS } from './planSchema.js';

const HEB = 'אבגדהוזחטיכלמנסעפצקרשת';
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const vec = (v, d = [0, 0, 0]) => (Array.isArray(v) && v.length === 3 && v.every((x) => Number.isFinite(+x)) ? v.map(Number) : d);
const str = (v, d = '') => (typeof v === 'string' ? v : d);
const arr = (v) => (Array.isArray(v) ? v : []);

export function normalizePlan(raw) {
  const p = raw && typeof raw === 'object' ? raw : {};
  const steps = arr(p.steps).map((s, i) => ({
    title: str(s?.title, `שלב ${i + 1}`),
    description: str(s?.description),
    tools: arr(s?.tools).filter((t) => typeof t === 'string'),
    hardware: arr(s?.hardware).map((h) => ({ name: str(h?.name), qty: num(h?.qty, 1) })).filter((h) => h.name),
    tip: str(s?.tip),
    warning: str(s?.warning),
    finish: !!s?.finish,
  }));
  if (!steps.length) steps.push({ title: 'הרכבה', description: '', tools: [], hardware: [], tip: '', warning: '', finish: false });
  const last = steps.length - 1;

  const parts = arr(p.parts)
    .map((q, i) => {
      const shape = ['box', 'cylinder', 'tube', 'squareTube'].includes(q?.shape) ? q.shape : 'box';
      const part = {
        id: str(q?.id, `p${i}`) || `p${i}`,
        name: str(q?.name, 'חלק'),
        shape,
        size: vec(q?.size, null),
        radius: Math.max(0.05, num(q?.radius, 2)),
        length: Math.max(0.1, num(q?.length, 10)),
        wall: Math.max(0.05, num(q?.wall, 0.2)),
        position: vec(q?.position),
        rotation: vec(q?.rotation),
        material: MATERIALS[q?.material] ? q.material : 'pine',
        color: /^#[0-9a-f]{6}$/i.test(q?.color) ? q.color : null,
        step: Math.min(last, Math.max(0, Math.round(num(q?.step)))),
        from: vec(q?.from, null),
      };
      if ((shape === 'box' || shape === 'squareTube') && !(part.size && part.size.every((x) => x > 0))) return null;
      return part;
    })
    .filter(Boolean);

  const shopping = arr(p.shopping).map((s) => ({
    item: str(s?.item, 'פריט'), spec: str(s?.spec), qty: Math.max(0, num(s?.qty, 1)), unit: str(s?.unit, 'יח׳'),
    unitPrice: Math.max(0, num(s?.unitPrice)), store: str(s?.store), url: /^https?:\/\//.test(s?.url) ? s.url : '',
    estimated: !!s?.estimated,
  }));

  const cutList = arr(p.cutList)
    .map((b) => ({
      stock: str(b?.stock, 'חומר גלם'), stockLength: num(b?.stockLength), stockWidth: num(b?.stockWidth),
      cuts: arr(b?.cuts).map((c) => ({ name: str(c?.name), length: num(c?.length), width: num(c?.width), angle: num(c?.angle) })).filter((c) => c.length > 0),
    }))
    .filter((b) => b.stockLength > 0);

  const plan = {
    title: str(p.title, 'פרויקט ללא שם'),
    summary: str(p.summary),
    difficulty: p.difficulty === 'מתקדם' ? 'קשה' : str(p.difficulty, 'בינוני'),
    timeHours: num(p.timeHours),
    dimensions: { width: num(p.dimensions?.width), height: num(p.dimensions?.height), depth: num(p.dimensions?.depth) },
    parts, steps, shopping, cutList,
    tools: arr(p.tools).map((t) => ({ name: str(t?.name), purpose: str(t?.purpose), essential: t?.essential !== false, estPrice: num(t?.estPrice) })).filter((t) => t.name),
    priceNote: str(p.priceNote),
    stores: arr(p.stores).map((x) => ({
      name: str(x?.name), location: str(x?.location), url: /^https?:\/\//.test(x?.url) ? x.url : '',
      sells: str(x?.sells), cutService: !!x?.cutService, note: str(x?.note),
    })).filter((x) => x.name),
    simplifications: arr(p.simplifications).filter((x) => typeof x === 'string' && x),
    sources: arr(p.sources).filter((s) => /^https?:\/\//.test(s?.url)).map((s) => ({ url: s.url, title: str(s.title, s.url) })),
    request: p.request || {},
  };
  plan.groups = groupParts(parts);
  return plan;
}

/** Extent of a part's own geometry, before rotation: [x,y,z]. */
export function partDims(p) {
  if (p.shape === 'box' || p.shape === 'squareTube') return p.size;
  return [p.radius * 2, p.length, p.radius * 2];
}

/** Identical pieces share a letter (א, ב, ...) like a LEGO/IKEA parts page. */
export function groupParts(parts) {
  const map = new Map();
  for (const p of parts) {
    const dims = partDims(p).map((d) => Math.round(d * 10) / 10).sort((a, b) => b - a);
    const key = [p.name, p.shape, p.material, dims.join('x')].join('|');
    if (!map.has(key)) map.set(key, { key, name: p.name, shape: p.shape, material: p.material, dims, ids: [], sample: p });
    map.get(key).ids.push(p.id);
  }
  const groups = [...map.values()].sort((a, b) => b.dims[0] - a.dims[0]);
  groups.forEach((g, i) => (g.letter = HEB[i % HEB.length] + (i >= HEB.length ? Math.floor(i / HEB.length) + 1 : '')));
  return groups;
}

export const groupOf = (plan, partId) => plan.groups.find((g) => g.ids.includes(partId));

export function totals(plan) {
  const materials = plan.shopping.reduce((s, x) => s + x.qty * x.unitPrice, 0);
  const tools = plan.tools.reduce((s, t) => s + (t.estPrice || 0), 0);
  return { materials: Math.round(materials), tools: Math.round(tools) };
}

/** Parts that a step adds, grouped: [{group, qty}] */
export function stepParts(plan, stepIdx) {
  const out = new Map();
  for (const p of plan.parts) if (p.step === stepIdx) {
    const g = groupOf(plan, p.id);
    out.set(g, (out.get(g) || 0) + 1);
  }
  return [...out].map(([group, qty]) => ({ group, qty }));
}

/** Simple row packing of sheet cuts for drawing (the AI already chose which sheet). */
export function packSheet(board, kerf = 0.3) {
  let x = 0, y = 0, rowH = 0;
  const placed = [];
  for (const c of [...board.cuts].sort((a, b) => (b.width || 0) - (a.width || 0))) {
    const w = c.length, h = c.width || 5;
    if (x + w > board.stockLength + 0.01) { x = 0; y += rowH + kerf; rowH = 0; }
    placed.push({ ...c, x, y, w, h, overflow: y + h > board.stockWidth + 0.01 });
    x += w + kerf; rowH = Math.max(rowH, h);
  }
  return placed;
}

export const fmtCm = (v) => `${Math.round(v * 10) / 10} ס״מ`;
export const fmtILS = (v) => `₪${Math.round(v).toLocaleString('he-IL')}`;
export const materialName = (m) => MATERIALS[m] || EXTRA_NAMES[m] || m;

// Names for materials the user can pick in the customize tab (not part of the AI's schema).
const EXTRA_NAMES = { wenge: 'וונגה', whitewash: 'עץ מולבן', black_matte: 'שחור מט', black_gloss: 'שחור מבריק', raw_steel: 'ברזל גולמי', white_coat: 'ברזל צבוע לבן' };
