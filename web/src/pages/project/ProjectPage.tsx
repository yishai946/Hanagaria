import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { fmtCm, fmtILS, materialName, stepParts, totals } from '@shared/plan';
import type { Plan } from '@shared/types';
import { Icon } from '../../components/Icon';
import { applyCustom } from '../../lib/customize';
import { DEFAULT_CUSTOM, type Custom } from '../../lib/finishes';
import { store } from '../../lib/storage';
import { Viewer3D } from '../../three/LazyViewer';
import { CustomizePane, CutsPane, PartInfo, ShopPane, ToolsPane } from './panes';

const TABS = [['steps', 'בנייה'], ['custom', 'התאמה'], ['shop', 'קניות'], ['cuts', 'חיתוכים'], ['tools', 'כלים']] as const;
type Tab = (typeof TABS)[number][0];

export function ProjectPage({ id, plan: basePlan }: { id: string; plan: Plan }) {
  const [custom, setCustom] = useState<Custom>(() => ({ ...DEFAULT_CUSTOM, ...store.get(`sadna-custom-${id}`, {}) }));
  const updateCustom = (patch: Partial<Custom>) => setCustom((c) => { const n = { ...c, ...patch }; store.set(`sadna-custom-${id}`, n); return n; });
  const plan = useMemo(() => applyCustom(basePlan, custom), [basePlan, custom]);
  const [step, setStep] = useState(-1);
  const [tab, setTab] = useState<Tab>('steps');
  const [explode, setExplode] = useState(0);
  const [ghost, setGhost] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [done, setDone] = useState<number[]>(() => store.get(`sadna-done-${id}`, []));
  const last = plan.steps.length - 1;
  const t = totals(plan);

  const go = useCallback((n: number) => setStep(Math.max(-1, Math.min(last, n))), [last]);
  useEffect(() => {
    if (!playing) return;
    if (step >= last) { setPlaying(false); return; }
    const tm = setTimeout(() => go(step + 1), step < 0 ? 2500 : 4200);
    return () => clearTimeout(tm);
  }, [playing, step, last, go]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.target as Element).closest('input,textarea')) return;
      if (e.key === 'ArrowLeft') { setPlaying(false); go(step + 1); }
      if (e.key === 'ArrowRight') { setPlaying(false); go(step - 1); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [step, go]);
  const toggleDone = (i: number) => { const d = done.includes(i) ? done.filter((x) => x !== i) : [...done, i]; setDone(d); store.set(`sadna-done-${id}`, d); };

  const cur = plan.steps[step];
  const newParts = step >= 0 ? stepParts(plan, step) : [];
  const sel = selected ? plan.parts.find((p) => p.id === selected) : undefined;
  const d = plan.dimensions;

  return (
    <div className="project">
      <div className="stage">
        <Suspense fallback={<div className="stage-loading">טוען תלת־ממד…</div>}>
          <Viewer3D plan={plan} step={step} explode={explode} ghost={ghost} autoRotate={autoRotate} replay={replay} selected={selected} onSelect={setSelected} />
        </Suspense>
      </div>

      <header className="proj-bar">
        <div className="proj-head">
          <a href="#/" className="round-btn" aria-label="חזרה לדף הבית"><Icon n="back" /></a>
          <div className="proj-title">
            <h1>{plan.title}</h1>
            <span>{[plan.difficulty, plan.timeHours > 0 && `${plan.timeHours} שעות`, d.width > 0 && `${d.width}×${d.depth}×${d.height} ס״מ`].filter(Boolean).join(' · ')}</span>
          </div>
        </div>
        <nav className="tabs gl" role="tablist" aria-label="תצוגה">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <button className="price-pill gl" onClick={() => setTab('shop')}><b>{fmtILS(t.materials)}</b><span>חומרים</span></button>
      </header>

      {tab === 'steps' ? (
        <aside className="now gl" key={step}>
          {!cur ? (
            <>
              <div><span className="lbl">לפני שמתחילים</span><b className="now-title">מה יש בקופסה</b></div>
              <p className="now-desc">{plan.parts.length} חלקים ב־{plan.groups.length} סוגים. כל סוג מסומן באות — חפשו אותה על החלק ובשלבים.</p>
              <ul className="inv-list">{plan.groups.map((g) => (
                <li key={g.key}><span className="tag3d">{g.letter}</span><b>{g.ids.length}×</b> {g.name} <small>{g.dims.map(fmtCm).join(' × ')} · {materialName(g.material)}</small></li>
              ))}</ul>
            </>
          ) : (
            <>
              <div className="now-head">
                <span className="now-num">{step + 1}</span>
                <div><span className="lbl">שלב {step + 1} מתוך {plan.steps.length}</span><b className="now-title">{cur.title}</b></div>
              </div>
              <p className="now-desc">{cur.description}</p>
              {newParts.length > 0 && (
                <div className="now-block"><span className="lbl">חלקים שמתווספים</span>
                  <ul className="pieces">{newParts.map(({ group, qty }) => <li key={group.key}><span className="tag3d">{group.letter}</span><b>{qty}×</b> {group.name}</li>)}</ul></div>
              )}
              {cur.hardware.length > 0 && <ul className="pieces hw">{cur.hardware.map((h, i) => <li key={i}><b>{h.qty}×</b> {h.name}</li>)}</ul>}
              {cur.tools.length > 0 && <div className="now-block"><span className="lbl">כלים לשלב</span><div className="tags">{cur.tools.map((x) => <span key={x}>{x}</span>)}</div></div>}
              {cur.warning && <div className="note warn"><b>בטיחות:</b> {cur.warning}</div>}
              {cur.tip && <div className="note tip"><b>טיפ:</b> {cur.tip}</div>}
              <button className={`ghost-btn ${done.includes(step) ? 'on' : ''}`} onClick={() => toggleDone(step)} aria-pressed={done.includes(step)}>
                {done.includes(step) ? '✓ בוצע' : 'סמנו כבוצע'} <small>({done.length}/{plan.steps.length})</small>
              </button>
            </>
          )}
        </aside>
      ) : (
        <aside className="panel gl" aria-label="פרטים">
          <div className="pane" key={tab}>
            {tab === 'custom' && <CustomizePane base={basePlan} custom={custom} update={updateCustom} />}
            {tab === 'shop' && <ShopPane plan={plan} />}
            {tab === 'cuts' && <CutsPane plan={plan} />}
            {tab === 'tools' && <ToolsPane plan={plan} />}
          </div>
        </aside>
      )}

      {sel && <PartInfo plan={plan} part={sel} onClose={() => setSelected(null)} />}

      <div className="view-tools gl">
        <label className="tool-chip range">פיצוץ <input type="range" min="0" max="1" step="0.01" value={explode} onChange={(e) => setExplode(+e.target.value)} aria-label="תצוגה מפוצצת" /></label>
        <button className={`tool-chip ${ghost ? 'on' : ''}`} onClick={() => setGhost(!ghost)} aria-pressed={ghost}>חלקים עתידיים</button>
        <button className={`tool-chip ${autoRotate ? 'on' : ''}`} onClick={() => setAutoRotate(!autoRotate)} aria-pressed={autoRotate}>סיבוב</button>
        {step >= 0 && <button className="tool-chip" onClick={() => setReplay((r) => r + 1)}>הצג שוב</button>}
      </div>

      <div className="dock-wrap">
        <div className="dock">
          <button className="nav primary" onClick={() => { setPlaying(false); go(step + 1); }} disabled={step >= last} aria-label="שלב הבא"><Icon n="next" s={24} /></button>
          <div className="stepbar-mid">
            <div className="stepbar-title">{!cur ? 'מה יש בקופסה' : `שלב ${step + 1} · ${cur.title}`}</div>
            <div className="dots">
              {[-1, ...plan.steps.keys()].map((i) => <button key={i} className={i < step ? 'done' : i === step ? 'cur' : ''} onClick={() => { setPlaying(false); go(i); }} aria-label={i < 0 ? 'מה יש בקופסה' : `שלב ${i + 1}: ${plan.steps[i]!.title}`} title={i < 0 ? 'מה יש בקופסה' : plan.steps[i]!.title} />)}
            </div>
          </div>
          <button className="nav" onClick={() => { if (step >= last) go(-1); setPlaying(!playing); }} aria-label={playing ? 'עצור' : 'נגן הרכבה'}><Icon n={playing ? 'pause' : 'play'} s={18} /></button>
          <button className="nav" onClick={() => { setPlaying(false); go(step - 1); }} disabled={step < 0} aria-label="שלב קודם"><Icon n="prev" s={20} /></button>
        </div>
      </div>
    </div>
  );
}
