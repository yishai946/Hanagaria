import { Suspense, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, Lightformer, Grid, Html, Line } from '@react-three/drei';
import { EffectComposer, N8AO } from '@react-three/postprocessing';
import { makeGeometry, makeMaterial, partBox, toEuler, isWood } from './assets';
import { groupOf, fmtCm } from '@shared/plan';
import type { Part, Plan, PartGroup } from '@shared/types';

const ACCENT = new THREE.Color('#ff6a2b');
const SELECT = new THREE.Color('#2d8cff');
// drei Html mounted before the canvas connects its events renders empty (React 19); wait for the connection.
function Label(props: ComponentProps<typeof Html>) {
  const connected = useThree((s) => s.events.connected);
  return connected ? <Html {...props} /> : null;
}

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

function modelBounds(parts: Part[]) {
  const b = new THREE.Box3();
  parts.forEach((p) => b.union(partBox(p)));
  if (b.isEmpty()) b.set(new THREE.Vector3(-50, 0, -50), new THREE.Vector3(50, 50, 50));
  return b;
}

/** Flat "parts page": one stack per identical group, laid out in rows. */
interface InvItem { g: PartGroup; part: Part; L: number; W: number; T: number; qty: number; copies: number; w1: number; x: number; z: number }
type InventoryLayout = { items: InvItem[]; box: THREE.Box3 };

function inventoryLayout(plan: Plan): InventoryLayout {
  const items = plan.groups.map((g) => {
    const [L, W, T] = g.dims as [number, number, number], p = g.sample;
    const round = p.shape === 'cylinder' || p.shape === 'tube';
    const part: Part = round ? { ...p, rotation: [0, 0, 90] } : { ...p, size: [L, T, W], rotation: [0, 0, 0] };
    const qty = g.ids.length, copies = Math.min(qty, 3);
    return { g, part, L, W: W * copies + (copies - 1) * 1.5, T, qty, copies, w1: W, x: 0, z: 0 };
  });
  const maxL = Math.max(...items.map((i) => i.L), 10);
  const area = items.reduce((s, i) => s + i.L * (i.W + 14), 0);
  const rowMax = Math.max(maxL, Math.sqrt(area) * 1.6);
  const gap = Math.max(8, maxL * 0.08);
  let x = 0, z = 0, rowDepth = 0;
  for (const it of items) {
    if (x > 0 && x + it.L > rowMax) { x = 0; z += rowDepth + gap; rowDepth = 0; }
    it.x = x + it.L / 2; it.z = z + it.W / 2; x += it.L + gap; rowDepth = Math.max(rowDepth, it.W + 16);
  }
  const box = new THREE.Box3();
  items.forEach((it) => box.expandByPoint(new THREE.Vector3(it.x - it.L / 2, 0, it.z - it.W / 2)).expandByPoint(new THREE.Vector3(it.x + it.L / 2, it.T, it.z + it.W / 2 + 8)));
  const c = box.getCenter(new THREE.Vector3());
  items.forEach((it) => { it.x -= c.x; it.z -= c.z; });
  box.translate(new THREE.Vector3(-c.x, 0, -c.z));
  return { items, box };
}

export interface Viewer3DProps {
  plan: Plan; step: number; explode: number; ghost: boolean; autoRotate: boolean; replay: number;
  selected: string | null; onSelect: (id: string | null) => void;
}

export default function Viewer3D(props: Viewer3DProps) {
  const { plan, step } = props;
  const bounds = useMemo(() => modelBounds(plan.parts), [plan]);
  const inventory = useMemo(() => inventoryLayout(plan), [plan]);
  const view = step < 0 ? inventory.box : bounds;
  const radius = Math.max(10, view.getSize(new THREE.Vector3()).length() / 2);
  const modelR = Math.max(10, bounds.getSize(new THREE.Vector3()).length() / 2);

  return (
    <Canvas shadows dpr={[1, 2]} camera={{ fov: 35, near: 1, far: 20000, position: [200, 160, 240] }} onPointerMissed={() => props.onSelect(null)} gl={{ antialias: true }} style={{ direction: 'ltr' }}>
      <Lights r={modelR} />
      <Suspense fallback={null}>
      <Environment resolution={256} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#fff4e6" position={[0, 6, 6]} scale={[12, 5, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#ffffff" position={[-8, 3, -2]} rotation-y={Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#ffe3c4" position={[8, 2, -4]} rotation-y={-Math.PI / 2} scale={[10, 3, 1]} />
        <Lightformer form="circle" intensity={3} position={[0, 10, 0]} rotation-x={Math.PI / 2} scale={4} />
      </Environment>
      </Suspense>
      {step < 0 ? <Inventory key={plan.title + 'inv'} layout={inventory} /> : <Assembly key={plan.title + plan.parts.length} {...props} center={bounds.getCenter(new THREE.Vector3())} />}
      <mesh rotation-x={-Math.PI / 2} position-y={-0.02} receiveShadow>
        <planeGeometry args={[radius * 20, radius * 20]} />
        <shadowMaterial opacity={0.14} />
      </mesh>
      <ContactShadows position={[0, 0.03, 0]} scale={radius * 4} far={radius * 1.2} blur={2.2} opacity={0.45} resolution={1024} color="#3a2616" />
      <Grid position={[0, 0.01, 0]} infiniteGrid cellSize={radius < 60 ? 5 : 10} sectionSize={radius < 60 ? 25 : 50} fadeDistance={radius * 9} fadeStrength={1.6} cellColor="#d9d5cb" sectionColor="#c4bfb3" cellThickness={0.6} sectionThickness={1.1} />
      <CameraRig plan={plan} step={step} view={view} radius={radius} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} autoRotate={props.autoRotate} autoRotateSpeed={1.1} maxPolarAngle={Math.PI * 0.495} minDistance={radius * 0.3} maxDistance={radius * 8} />
      {/* Own boundary: if post-processing suspends while loading, the scene (and its HTML labels) must not remount. */}
      <Suspense fallback={null}>
      <EffectComposer multisampling={4}>
        <N8AO aoRadius={Math.max(4, modelR * 0.12)} distanceFalloff={1} intensity={2.2} halfRes color="#2a1a0c" />
      </EffectComposer>
      </Suspense>
    </Canvas>
  );
}

function Lights({ r }: { r: number }) {
  const light = useRef<THREE.DirectionalLight>(null);
  useEffect(() => {
    const s = light.current!.shadow.camera;
    s.left = s.bottom = -r * 1.6; s.right = s.top = r * 1.6; s.near = 1; s.far = r * 10; s.updateProjectionMatrix();
  }, [r]);
  return (
    <>
      <hemisphereLight args={['#fff3e2', '#8b7a63', 0.5]} />
      <directionalLight ref={light} position={[r * 1.4, r * 2.6, r * 1.1]} intensity={1.9} color="#fff1dc" castShadow shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004} shadow-normalBias={0.04} />
    </>
  );
}

interface Tween { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; s: number; d: number }

function CameraRig({ plan, step, view, radius }: { plan: Plan; step: number; view: THREE.Box3; radius: number }) {
  const { camera: cam, size } = useThree();
  const camera = cam as THREE.PerspectiveCamera;
  const controls = useThree((s) => s.controls) as unknown as { target: THREE.Vector3 } | null;
  const aspect = size.width / Math.max(1, size.height);
  const tween = useRef<Tween | null>(null);
  const lastPlan = useRef<string | null>(null);
  const lastRadius = useRef(radius);
  const planKey = plan.title + plan.parts.length;
  const wasInventory = useRef<boolean | null>(null);

  useEffect(() => {
    if (!controls) return;
    const center = view.getCenter(new THREE.Vector3());
    const fullFit = lastPlan.current !== planKey || wasInventory.current !== step < 0;
    const grow = radius / lastRadius.current; lastRadius.current = radius;
    lastPlan.current = planKey; wasInventory.current = step < 0;
    let p1: THREE.Vector3;
    const t1 = center.clone();
    if (fullFit) {
      const vf = THREE.MathUtils.degToRad(camera.fov), hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
      const dist = (radius / Math.sin(Math.min(vf, hf) / 2)) * (aspect < 1 ? 1.05 : 0.85);
      p1 = center.clone().add(new THREE.Vector3(-1, step < 0 ? 1.4 : 0.78, 1.35).normalize().multiplyScalar(dist));
    } else {
      // Gentle pan toward this step's new parts, keeping the user's angle and zoom.
      const nb = new THREE.Box3();
      plan.parts.filter((q) => q.step === step).forEach((q) => nb.union(partBox(q)));
      if (!nb.isEmpty()) t1.lerp(nb.getCenter(new THREE.Vector3()), 0.45);
      p1 = t1.clone().add(camera.position.clone().sub(controls.target).multiplyScalar(grow));
    }
    tween.current = { p0: camera.position.clone(), p1, t0: controls.target.clone(), t1, s: performance.now(), d: fullFit ? 1100 : 700 };
  }, [planKey, radius, step, controls]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame(() => {
    const tw = tween.current;
    if (!tw || !controls) return;
    const e = easeOut(clamp01((performance.now() - tw.s) / tw.d));
    camera.position.lerpVectors(tw.p0, tw.p1, e);
    controls.target.lerpVectors(tw.t0, tw.t1, e);
    if (e >= 1) tween.current = null;
  });
  return null;
}

interface PartRefs { group?: THREE.Group; mesh?: THREE.Mesh; mat?: THREE.MeshPhysicalMaterial; edge?: THREE.LineBasicMaterial; arrow?: THREE.Group; arrowMats?: THREE.Material[] }
type Refs = React.RefObject<Record<string, PartRefs>>;
type Register = <K extends keyof PartRefs>(id: string, key: K) => (el: PartRefs[K] | null) => void;

function Assembly({ plan, step, explode, ghost, replay, selected, onSelect, center }: Viewer3DProps & { center: THREE.Vector3 }) {
  const refs: Refs = useRef({});
  const anim = useRef<Record<string, { shown: boolean; start: number }>>({});
  const explodeShown = useRef(0);
  const stepAt = useRef(0);
  const [hover, setHover] = useState<string | null>(null);
  const finishing = plan.steps[step]?.finish || step === plan.steps.length - 1;

  const planKey = useMemo(() => plan.parts.map((p) => p.id + p.step).join('|'), [plan]);
  useEffect(() => {
    const now = performance.now();
    let order = 0;
    for (const p of plan.parts) {
      const s = (anim.current[p.id] ||= { shown: false, start: -1e9 });
      if (p.step === step) s.start = now + 120 + order++ * 140;
      else if (p.step < step && !s.shown) s.start = now - 1e5;
      s.shown = p.step <= step;
    }
    stepAt.current = now;
  }, [planKey, step, replay]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { document.body.style.cursor = hover ? 'pointer' : ''; return () => { document.body.style.cursor = ''; }; }, [hover]);

  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const now = performance.now();
    explodeShown.current += (explode - explodeShown.current) * 0.12;
    const pulse = clamp01(1 - (now - stepAt.current) / 3200);
    for (const p of plan.parts) {
      const r = refs.current[p.id], s = anim.current[p.id];
      if (!r?.group || !r.mat || !r.mesh || !r.edge || !s) continue;
      let a = 0, e = 1;
      if (s.shown) { const t = clamp01((now - s.start) / 850); e = easeOut(t); a = clamp01(t * 3); }
      else if (ghost) a = 0.12;
      r.group.visible = a > 0.004;
      if (r.arrow) {
        const age = now - s.start, show = s.shown && p.step === step && age > -100 && age < 2200;
        r.arrow.visible = show;
        if (show) r.arrowMats?.forEach((m) => (m.opacity = 0.85 * clamp01(age < 900 ? (age + 100) / 300 : (2200 - age) / 600)));
      }
      if (!r.group.visible) continue;
      v.set(...p.position).sub(center).multiplyScalar(explodeShown.current * 0.8);
      r.group.position.set(p.position[0] + v.x, p.position[1] + v.y, p.position[2] + v.z);
      if (s.shown && e < 1) {
        const f = p.from || [0, 30, 0], k = 1 - e;
        r.group.position.x += f[0] * k; r.group.position.y += f[1] * k; r.group.position.z += f[2] * k;
      }
      const m = r.mat, base = m.userData.baseOpacity ?? 1;
      m.opacity = a * base; m.depthWrite = a > 0.97; r.mesh.castShadow = a > 0.9;
      if (isWood(p.material)) { m.clearcoat += ((m.userData.coat ?? (finishing ? 0.8 : 0)) - m.clearcoat) * 0.05; }
      const isNew = s.shown && p.step === step && !plan.steps[step]?.finish;
      if (selected === p.id) { m.emissive.copy(SELECT); m.emissiveIntensity = 0.35; }
      else if (hover === p.id) { m.emissive.copy(ACCENT); m.emissiveIntensity = 0.22; }
      else if (isNew) { m.emissive.copy(ACCENT); m.emissiveIntensity = 0.28 * pulse * (0.6 + 0.4 * Math.sin(now / 150)); }
      else m.emissiveIntensity = 0;
      r.edge.opacity = (s.shown ? 0.38 : 0.55) * a;
      r.edge.color.set(selected === p.id ? '#2d8cff' : '#2b2219');
    }
  });

  const register: Register = (id, key) => (el) => { if (el) (refs.current[id] ||= {})[key] = el; };
  const firstOfGroup = useMemo(() => {
    const seen = new Set();
    return plan.parts.filter((p) => p.step === step && !seen.has(groupOf(plan, p.id)) && seen.add(groupOf(plan, p.id)));
  }, [plan, step]);
  const hovered = hover && plan.parts.find((p) => p.id === hover);

  return (
    <group>
      {plan.parts.map((p) => (
        <PartMesh key={p.id} p={p} register={register} onSelect={onSelect} setHover={setHover} refs={refs} />
      ))}
      {plan.parts.filter((p) => p.from).map((p) => <Arrow key={'a' + p.id} p={p} refs={refs} />)}
      {firstOfGroup.map((p) => {
        const b = partBox(p);
        return (
          <Label key={'l' + p.id + step} position={[(b.min.x + b.max.x) / 2, b.max.y + 3, (b.min.z + b.max.z) / 2]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <span className="tag3d">{groupOf(plan, p.id).letter}</span>
          </Label>
        );
      })}
      {hovered && (
        <Label position={partBox(hovered).getCenter(new THREE.Vector3())} center zIndexRange={[30, 0]} style={{ pointerEvents: 'none' }}>
          <div className="hover3d"><b>{groupOf(plan, hovered.id).letter}</b> {hovered.name}</div>
        </Label>
      )}
    </group>
  );
}

interface PartMeshProps {
  p: Part; register: Register; onSelect: (id: string) => void;
  setHover: React.Dispatch<React.SetStateAction<string | null>>; refs: Refs;
}
function PartMesh({ p, register, onSelect, setHover, refs }: PartMeshProps) {
  const geo = useMemo(() => makeGeometry(p), [p]);
  const mat = useMemo(() => makeMaterial(p.material, p.color, p.finish), [p]);
  const edges = useMemo(() => new THREE.EdgesGeometry(p.shape === 'box' ? new THREE.BoxGeometry(...p.size!) : geo, 25), [geo, p]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); edges.dispose(); }, [geo, mat, edges]);
  useEffect(() => { (refs.current[p.id] ||= {}).mat = mat; }, [mat, p.id, refs]);
  return (
    <group ref={register(p.id, 'group')} position={p.position}>
      <mesh
        ref={register(p.id, 'mesh')} geometry={geo} material={mat} rotation={toEuler(p.rotation)} castShadow receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHover(p.id); }}
        onPointerOut={() => setHover((h) => (h === p.id ? null : h))}
        onClick={(e) => { e.stopPropagation(); onSelect(p.id); }}
      >
        <lineSegments geometry={edges} raycast={() => null}>
          <lineBasicMaterial ref={register(p.id, 'edge')} color="#2b2219" transparent opacity={0} />
        </lineSegments>
      </mesh>
    </group>
  );
}

/** LEGO-style motion arrow showing how a piece slides into place. */
function Arrow({ p, refs }: { p: Part; refs: Refs }) {
  const f = new THREE.Vector3(...p.from!);
  const len = f.length();
  if (len < 1) return null;
  const dir = f.clone().normalize();
  const target = new THREE.Vector3(...p.position);
  const start = target.clone().add(f.clone().multiplyScalar(1.05));
  const end = target.clone().add(dir.clone().multiplyScalar(Math.min(len * 0.3, 6)));
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().negate());
  const head = Math.max(1.2, Math.min(4, len * 0.08));
  const setGroup = (el: THREE.Group | null) => { if (el) (refs.current[p.id] ||= {}).arrow = el; };
  const addMat = (el: THREE.Material | null) => { if (el) { const r = (refs.current[p.id] ||= {}); r.arrowMats = [...new Set([...(r.arrowMats || []), el])]; } };
  return (
    <group ref={setGroup} visible={false}>
      <Line points={[start, end]} color="#ff6a2b" lineWidth={2.5} dashed dashSize={2} gapSize={1.2} transparent opacity={0} ref={(l) => { if (l) addMat(l.material as THREE.Material); }} />
      <mesh position={end} quaternion={quat} raycast={() => null}>
        <coneGeometry args={[head * 0.45, head, 16]} />
        <meshBasicMaterial ref={addMat} color="#ff6a2b" transparent opacity={0} depthTest={false} />
      </mesh>
    </group>
  );
}

function Inventory({ layout }: { layout: InventoryLayout }) {
  const refs = useRef<(THREE.Group | null)[]>([]);
  const t0 = useRef(performance.now());
  useFrame(() => {
    const now = performance.now();
    refs.current.forEach((g, i) => {
      if (!g) return;
      const e = easeOut(clamp01((now - t0.current - i * 90) / 600));
      g.position.y = (1 - e) * 25;
      g.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.Material | undefined; if (m) { m.opacity = e * (m.userData.baseOpacity ?? 1); m.depthWrite = e > 0.97; } });
    });
  });
  return (
    <group>
      {layout.items.map((it, i) => (
        <group key={it.g.key} position={[it.x, 0, it.z]} ref={(el) => (refs.current[i] = el)}>
          {[...Array(it.copies)].map((_, k) => <InventoryPiece key={k} part={it.part} y={it.T / 2} dz={(k - (it.copies - 1) / 2) * (it.w1 + 1.5)} />)}
          <Label position={[0, it.T + 2, it.W / 2 + 4]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div className="inv3d"><span className="tag3d">{it.g.letter}</span><b>{it.qty}×</b> {it.g.name}<small>{it.g.dims.filter((d) => d > 0).map(fmtCm).join(' × ')}</small></div>
          </Label>
        </group>
      ))}
    </group>
  );
}

function InventoryPiece({ part, y, dz }: { part: Part; y: number; dz: number }) {
  const geo = useMemo(() => makeGeometry(part), [part]);
  const mat = useMemo(() => { const m = makeMaterial(part.material, part.color); m.opacity = 0; return m; }, [part]);
  const edges = useMemo(() => new THREE.EdgesGeometry(geo, 25), [geo]);
  useEffect(() => () => { geo.dispose(); mat.dispose(); edges.dispose(); }, [geo, mat, edges]);
  return (
    <mesh geometry={geo} material={mat} position={[0, y, dz]} rotation={toEuler(part.rotation)} castShadow receiveShadow>
      <lineSegments geometry={edges}><lineBasicMaterial color="#2b2219" transparent opacity={0} userData={{ baseOpacity: 0.35 }} /></lineSegments>
    </mesh>
  );
}
