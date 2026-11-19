// Applies the user's customization (size, wood tone, finishes) to a normalized plan. No three.js here: this runs in the main bundle.
import { groupParts } from './plan.js';
import { WOOD_MATERIALS, METAL_MATERIALS } from './finishes.js';

const LONG = 12; // cm: only dimensions longer than this stretch; thin profiles and board thickness stay real.

const mul = (a, b) => a.map((_, i) => [0, 1, 2].map((j) => a[i][0] * b[0][j] + a[i][1] * b[1][j] + a[i][2] * b[2][j]));
function rotation([x, y, z]) { // three.js 'XYZ' Euler: Rx * Ry * Rz
  const [cx, sx, cy, sy, cz, sz] = [x, y, z].flatMap((d) => [Math.cos((d * Math.PI) / 180), Math.sin((d * Math.PI) / 180)]);
  return mul(mul([[1, 0, 0], [0, cx, -sx], [0, sx, cx]], [[cy, 0, sy], [0, 1, 0], [-sy, 0, cy]]), [[cz, -sz, 0], [sz, cz, 0], [0, 0, 1]]);
}

function scaleSize(p, k) {
  // Local axis i of the part points along some world direction; stretch it by that direction's factor.
  const M = rotation(p.rotation);
  return p.size.map((v, i) => (v < LONG ? v : v * Math.hypot(k[0] * M[0][i], k[1] * M[1][i], k[2] * M[2][i])));
}

/** The plan's stated size, or (when the AI left it empty) the size of its parts. */
export function baseDims(plan) {
  const d = plan.dimensions;
  if (d.width > 0 && d.depth > 0 && d.height > 0) return d;
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (const p of plan.parts) {
    const sz = p.size || [p.radius * 2, p.length, p.radius * 2], M = rotation(p.rotation);
    for (let j = 0; j < 3; j++) {
      const h = sz.reduce((a, v, i) => a + Math.abs(M[j][i]) * v / 2, 0);
      lo[j] = Math.min(lo[j], p.position[j] - h); hi[j] = Math.max(hi[j], p.position[j] + h);
    }
  }
  const r = (j) => Math.max(1, Math.round(hi[j] - lo[j]));
  return plan.parts.length ? { width: r(0), height: r(1), depth: r(2) } : d;
}

export function applyCustom(plan, custom) {
  if (!isCustomized(custom)) return plan;
  const d0 = baseDims(plan), d = custom.dims;
  const k = d && d0.width > 0 && d0.depth > 0 && d0.height > 0 ? [d.width / d0.width, d.height / d0.height, d.depth / d0.depth] : [1, 1, 1];
  const resize = k.some((x) => Math.abs(x - 1) > 0.001);
  const parts = plan.parts.map((p) => {
    const q = { ...p };
    if (resize) {
      q.position = p.position.map((v, i) => v * k[i]);
      if (p.size) q.size = scaleSize(p, k);
    }
    // An explicit choice replaces the AI's paint colour; otherwise that colour stays as a tint.
    if (WOOD_MATERIALS.has(p.material)) {
      if (custom.wood !== 'auto') { q.material = custom.wood; q.color = null; }
      if (custom.woodFinish !== 'auto') q.finish = custom.woodFinish;
    } else if (METAL_MATERIALS.has(p.material) && custom.metal !== 'auto') { q.material = custom.metal; q.color = null; }
    return q;
  });
  return { ...plan, parts, groups: groupParts(parts), dimensions: resize ? { ...d0, ...d } : plan.dimensions };
}

export const isCustomized = (c) => !!c && (c.wood !== 'auto' || c.woodFinish !== 'auto' || c.metal !== 'auto' || !!c.dims);
