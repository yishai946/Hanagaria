// Procedural textures, geometry and materials for the parts. No downloaded assets needed.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Part, Vec3 } from '@shared/types';

function rng(s: number) { return () => { s |= 0; s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rgba = (h: string, a: number) => { const n = parseInt(h.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const rgb = (h: string) => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// Periodic value noise: tiles seamlessly, which the repeating textures need.
function hash(ix: number, iy: number, s: number) { let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(s, 1442695041); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x: number, y: number, px: number, py: number, s: number) {
  const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const X0 = ((x0 % px) + px) % px, X1 = (X0 + 1) % px, Y0 = ((y0 % py) + py) % py, Y1 = (Y0 + 1) % py;
  const a = hash(X0, Y0, s), b = hash(X1, Y0, s), c = hash(X0, Y1, s), d = hash(X1, Y1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

interface WoodSpec { base: string; dark: string; rings?: number; warp?: number; contrast?: number; fiber?: number; knots?: boolean; flecks?: boolean; pores?: boolean; flat?: boolean; osb?: boolean }
interface MetalSpec { color: string; metalness: number; roughness: number; tex?: 'brushed' | 'coat' | 'raw'; clearcoat?: number; bump?: number; glass?: boolean }

// rings: growth rings across the board; warp: how wavy; contrast: late/early wood; fiber: fine streaks
const WOOD: Record<string, WoodSpec> = {
  pine: { base: '#e6c28c', dark: '#a8693a', rings: 9, warp: 1.6, contrast: 0.7, fiber: 0.5, knots: true },
  pine_treated: { base: '#c2b47e', dark: '#7d7346', rings: 9, warp: 1.6, contrast: 0.6, fiber: 0.5, knots: true },
  beech: { base: '#e8c8a0', dark: '#b88457', rings: 16, warp: 0.6, contrast: 0.22, fiber: 0.55, flecks: true },
  oak: { base: '#cfa86f', dark: '#80582f', rings: 7, warp: 1.2, contrast: 0.5, fiber: 0.6, pores: true },
  walnut: { base: '#7a5033', dark: '#2f1b10', rings: 8, warp: 1.9, contrast: 0.55, fiber: 0.5 },
  teak: { base: '#b07a43', dark: '#6a3f1c', rings: 8, warp: 0.9, contrast: 0.35, fiber: 0.7 },
  wenge: { base: '#4a3428', dark: '#150d09', rings: 14, warp: 0.7, contrast: 0.8, fiber: 0.9 },
  whitewash: { base: '#ece5d5', dark: '#b3a58b', rings: 9, warp: 1.5, contrast: 0.5, fiber: 0.5, knots: true },
  plywood: { base: '#ead8b0', dark: '#bf9d6c', rings: 3, warp: 2.4, contrast: 0.35, fiber: 0.4 },
  mdf: { base: '#c7a47a', dark: '#a7845a', flat: true },
  osb: { base: '#d6b47c', dark: '#8f6a38', osb: true },
};
const METAL: Record<string, MetalSpec> = {
  steel: { color: '#8c9096', metalness: 0.9, roughness: 0.42, tex: 'brushed' },
  black_steel: { color: '#2a2b2e', metalness: 0.3, roughness: 0.55, tex: 'coat' },
  black_matte: { color: '#232427', metalness: 0.22, roughness: 0.64, tex: 'coat' },
  black_gloss: { color: '#101113', metalness: 0.35, roughness: 0.16, clearcoat: 0.7, tex: 'coat', bump: 0.04 },
  raw_steel: { color: '#8a8e95', metalness: 0.9, roughness: 0.55, tex: 'raw' },
  white_coat: { color: '#eceae4', metalness: 0.08, roughness: 0.48, tex: 'coat' },
  galvanized: { color: '#b9bec4', metalness: 0.85, roughness: 0.38, tex: 'brushed' },
  stainless: { color: '#cfd3d8', metalness: 1, roughness: 0.24, tex: 'brushed' },
  aluminum: { color: '#d6d9dd', metalness: 0.95, roughness: 0.32, tex: 'brushed' },
  brass: { color: '#c9a24a', metalness: 1, roughness: 0.3, tex: 'brushed' },
  rubber: { color: '#232323', metalness: 0, roughness: 0.95 },
  glass: { color: '#cfe8ee', metalness: 0, roughness: 0.05, glass: true },
};
export const isWood = (m: string) => !!WOOD[m];
export const isMetal = (m: string) => !!METAL[m] && m !== 'rubber' && m !== 'glass';

function woodCanvas(sp: WoodSpec, seed: number) {
  const { rings = 8, warp = 1, contrast = 0.5, fiber = 0.5 } = sp;
  const W = 2048, H = 512, S = W / 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d')!, R = rng(seed);
  g.fillStyle = sp.base; g.fillRect(0, 0, W, H);
  if (sp.osb) {
    for (let i = 0; i < 2400; i++) { g.fillStyle = rgba(R() < 0.5 ? sp.dark : '#f0d7a6', 0.25 + R() * 0.35); g.save(); g.translate(R() * W, R() * H); g.rotate(R() * 6.28); g.fillRect(-40 - R() * 60, -8 - R() * 12, 80 + R() * 120, 16 + R() * 20); g.restore(); }
    return c;
  }
  const img = g.createImageData(W, H), d = img.data, b = rgb(sp.base), k = rgb(sp.dark);
  for (let y = 0; y < H; y++) {
    const v = y / H;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      let t;
      if (sp.flat) t = 0.5 + (vnoise(u * 200, v * 100, 200, 100, 3) - 0.5) * 0.35;
      else {
        const wob = vnoise(u * 2, v * 3, 2, 3, 11) * warp + vnoise(u * 5, v * 7, 5, 7, 12) * warp * 0.25;
        const r = v * rings + wob, f = r - Math.floor(r);
        const late = Math.pow(smooth(0.35, 1, f), 2.2) * (1 - smooth(0.96, 1, f) * 0.6); // slow dark build-up, quick reset
        const fib = vnoise(u * 7, v * 130, 7, 130, 21) - 0.5, fib2 = vnoise(u * 28, v * 360, 28, 360, 22) - 0.5;
        const blot = vnoise(u * 2, v * 2, 2, 2, 31) - 0.5;
        t = 0.22 + late * contrast + fib * fiber * 0.55 + fib2 * fiber * 0.35 + blot * 0.18;
      }
      t = Math.max(0, Math.min(1, t));
      const o = (y * W + x) * 4;
      d[o] = b[0] + (k[0] - b[0]) * t; d[o + 1] = b[1] + (k[1] - b[1]) * t; d[o + 2] = b[2] + (k[2] - b[2]) * t; d[o + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  if (sp.knots) for (let i = 0; i < 2; i++) {
    const x = (100 + R() * 820) * S, y = (40 + R() * 176) * S * 2;
    for (let r = 20 * S; r > 1; r -= 2.6 * S) { g.strokeStyle = rgba(sp.dark, 0.3); g.lineWidth = 1.4 * S; g.beginPath(); g.ellipse(x, y, r * 2.6, r * 0.9, 0, 0, 6.283); g.stroke(); }
    const gr = g.createRadialGradient(x, y, 0, x, y, 9 * S); gr.addColorStop(0, 'rgba(60,32,14,0.9)'); gr.addColorStop(1, 'rgba(60,32,14,0)');
    g.fillStyle = gr; g.beginPath(); g.ellipse(x, y, 11 * S, 5 * S, 0, 0, 6.283); g.fill();
  }
  if (sp.pores) for (let i = 0; i < 5000; i++) { g.fillStyle = rgba(sp.dark, 0.28); g.fillRect(R() * W, R() * H, (3 + R() * 9) * S, 1.4); }
  if (sp.flecks) for (let i = 0; i < 260; i++) { g.fillStyle = rgba(sp.dark, 0.2); g.fillRect(R() * W, R() * H, (4 + R() * 12) * S, 1.5 + R() * 1.5); }
  return c;
}

// Grayscale detail maps. They multiply the material colour (map) and drive bump / roughness.
function noiseCanvas(size: number, fn: (u: number, v: number) => number) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!, img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const v = Math.max(0, Math.min(255, fn(x / size, y / size) * 255)), o = (y * size + x) * 4; img.data[o] = img.data[o + 1] = img.data[o + 2] = v; img.data[o + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
}
const brushedCanvas = () => noiseCanvas(512, (u, v) => 0.8 + (vnoise(u * 3, v * 240, 3, 240, 5) - 0.5) * 0.4 + (vnoise(u * 12, v * 500, 12, 500, 6) - 0.5) * 0.25 + (vnoise(u * 2, v * 2, 2, 2, 7) - 0.5) * 0.12);
const rawSteelCanvas = () => noiseCanvas(512, (u, v) => 0.7 + (vnoise(u * 4, v * 4, 4, 4, 8) - 0.5) * 0.55 + (vnoise(u * 16, v * 16, 16, 16, 9) - 0.5) * 0.3 + (vnoise(u * 3, v * 180, 3, 180, 10) - 0.5) * 0.18);
const coatCanvas = () => noiseCanvas(256, (u, v) => 0.5 + (vnoise(u * 96, v * 96, 96, 96, 13) - 0.5) * 0.9 + (vnoise(u * 32, v * 32, 32, 32, 14) - 0.5) * 0.4);

const texCache = new Map<string, THREE.CanvasTexture>();
function texture(key: string, make: () => HTMLCanvasElement, repeat?: number) {
  if (!texCache.has(key)) {
    const t = new THREE.CanvasTexture(make());
    t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 16;
    if (repeat) t.repeat.set(repeat, repeat);
    texCache.set(key, t);
  }
  return texCache.get(key)!;
}
// tint multiplies the texture; coat = clearcoat strength, cr = clearcoat roughness
const FINISH: Record<string, { rough: number; coat: number; tint: string; bump: number; cr?: number }> = {
  raw: { rough: 0.9, coat: 0, tint: '#ffffff', bump: 0.9 },
  oil: { rough: 0.55, coat: 0.08, tint: '#ecd2b0', bump: 0.6 },
  satin: { rough: 0.42, coat: 0.35, tint: '#f1dcc0', bump: 0.45, cr: 0.4 },
  gloss: { rough: 0.3, coat: 1, tint: '#efd8ba', bump: 0.3, cr: 0.06 },
};

/** A fresh material per part, so each can fade/highlight on its own. Textures are shared. */
export function makeMaterial(material: string, color?: string | null, finish?: string) {
  const wood = WOOD[material];
  if (wood) {
    const map = texture(material, () => woodCanvas(wood, 42));
    const f = finish ? FINISH[finish] : undefined;
    const mat = new THREE.MeshPhysicalMaterial({
      map, bumpMap: map, bumpScale: f ? f.bump : 0.6, color: color || (f ? f.tint : '#ffffff'), roughness: f ? f.rough : 0.78, metalness: 0,
      clearcoat: f ? f.coat : 0, clearcoatRoughness: f?.cr ?? 0.35, transparent: true, envMapIntensity: 0.8,
    });
    if (f) mat.userData.coat = f.coat; // set only when the user picked a finish; otherwise the plan's finishing step animates it
    return mat;
  }
  const m = METAL[material] || METAL.steel;
  const map = m.tex === 'brushed' ? texture('brushed', brushedCanvas) : m.tex === 'raw' ? texture('raw', rawSteelCanvas) : null;
  const bump = m.tex === 'coat' ? texture('coat', coatCanvas, 6) : m.tex === 'raw' ? map : null;
  return new THREE.MeshPhysicalMaterial({
    color: color || m.color, map, roughnessMap: m.tex === 'brushed' ? map : null, bumpMap: bump, bumpScale: m.bump ?? (m.tex === 'coat' ? 0.08 : 0.5),
    metalness: m.metalness, roughness: m.roughness,
    transparent: true, envMapIntensity: 1.2, clearcoat: m.glass ? 1 : m.clearcoat || 0, clearcoatRoughness: 0.08,
    userData: { baseOpacity: m.glass ? 0.35 : 1 },
  });
}

// Rounded box (a tiny bevel catches light like a sanded edge) with wood grain running along the longest axis. Texture covers 60x15 cm.
function boxGeometry([sx, sy, sz]: Vec3) {
  const d = [sx, sy, sz], r = Math.min(0.3, Math.min(...d) / 3);
  const geo = new RoundedBoxGeometry(sx, sy, sz, 3, r);
  const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
  const L = d.indexOf(Math.max(...d));
  for (let i = 0; i < pos.count; i++) {
    const n = [nor.getX(i), nor.getY(i), nor.getZ(i)], p = [pos.getX(i), pos.getY(i), pos.getZ(i)];
    const ax = n.map(Math.abs).indexOf(Math.max(...n.map(Math.abs)));
    let [ua, va] = [0, 1, 2].filter((a) => a !== ax);
    if (va === L) [ua, va] = [va, ua];
    const off = ax * 0.37 + (n[ax] > 0 ? 0.17 : 0);
    uv.setXY(i, (p[ua] + d[ua] / 2) / 60 + off, (p[va] + d[va] / 2) / 15 + off * 0.6);
  }
  return geo;
}

function roundedRect(w: number, h: number, r: number) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// Hollow rectangular steel profile with rounded corners; the hollow runs along the longest axis.
function squareTubeGeometry(size: Vec3, wall: number) {
  const L = size.indexOf(Math.max(...size)), [a, b] = [0, 1, 2].filter((i) => i !== L);
  const w = size[a], h = size[b], t = Math.min(wall, Math.min(w, h) / 2.5), r = Math.min(t * 1.5, Math.min(w, h) / 3);
  const shape = roundedRect(w, h, r);
  const hole = roundedRect(w - 2 * t, h - 2 * t, Math.max(0.01, r - t));
  shape.holes.push(new THREE.Path(hole.getPoints(8).reverse()));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: size[L], bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -size[L] / 2);
  // Extruded shape is (x=w, y=h, z=length); map to the real axes.
  if (L === 0) geo.rotateY(Math.PI / 2).rotateX(Math.PI / 2); // (size1,size2,len) -> (len,size1,size2)
  else if (L === 1) geo.rotateX(Math.PI / 2); // (size0,size2,len) -> (size0,len,size2)
  return geo;
}

function tubeGeometry(radius: number, length: number, wall: number) {
  const ri = Math.max(0.01, radius - wall), h = length / 2;
  const pts = [[ri, -h], [radius, -h], [radius, h], [ri, h], [ri, -h]].map(([x, y]) => new THREE.Vector2(x, y));
  return new THREE.LatheGeometry(pts, 40);
}

export function makeGeometry(p: Part): THREE.BufferGeometry {
  if (p.shape === 'box') return boxGeometry(p.size!);
  if (p.shape === 'squareTube') return squareTubeGeometry(p.size!, p.wall);
  if (p.shape === 'tube') return tubeGeometry(p.radius, p.length, p.wall);
  return new THREE.CylinderGeometry(p.radius, p.radius, p.length, 40);
}

const D2R = Math.PI / 180;
export const toEuler = (r: Vec3) => new THREE.Euler(r[0] * D2R, r[1] * D2R, r[2] * D2R);

/** World-space bounding box of a part in its assembled place. */
export function partBox(p: Part) {
  const s: Vec3 = (p.shape === 'box' || p.shape === 'squareTube') && p.size ? p.size : [p.radius * 2, p.length, p.radius * 2];
  const box = new THREE.Box3(new THREE.Vector3(-s[0] / 2, -s[1] / 2, -s[2] / 2), new THREE.Vector3(s[0] / 2, s[1] / 2, s[2] / 2));
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...p.position), new THREE.Quaternion().setFromEuler(toEuler(p.rotation)), new THREE.Vector3(1, 1, 1));
  return box.applyMatrix4(m);
}
