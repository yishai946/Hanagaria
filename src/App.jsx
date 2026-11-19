import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizePlan, stepParts, totals, fmtCm, fmtILS, materialName, packSheet, groupOf, partDims } from './plan.js';
import { DEMO_PLAN } from './demoPlan.js';
import { fileToImage, requestPlan, requestQuestions } from './api.js';
import { DIFFICULTIES, BUDGETS } from './planSchema.js';
import { cloudEnabled, useAuth, signInGoogle, signInEmail, signOut, listProjects, addProject, deleteProject } from './cloud.js';
import { applyCustom, isCustomized, baseDims } from './customize.js';
import { WOOD_TONES, WOOD_FINISHES, METAL_FINISHES, DEFAULT_CUSTOM, WOOD_MATERIALS, METAL_MATERIALS } from './finishes.js';

const Viewer3D = lazy(() => import('./Viewer3D.jsx'));

/* ---------- storage (per-browser conveniences; failures are non-fatal) ---------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
};
const PKEY = 'sadna-projects';
const loadProjects = () => store.get(PKEY, []);

const EXAMPLES = [
  'שולחן קפה מעץ אורן עם מדף תחתון, 110x60 ס״מ',
  'ספסל גינה מקורות אורן מוגן לשני אנשים',
  'מדף קיר תעשייתי מפרופיל ברזל ולוחות עץ',
  'שולחן עבודה לנגרייה עם מדף לכלים',
  'עציץ מוגבה לגינה מעץ, 120x60',
  'מתקן לאופניים מברזל לקיר',
];

const I = {
  back: <path d="M9 18l6-6-6-6" />, next: <path d="M15 18l-6-6 6-6" />, prev: <path d="M9 18l6-6-6-6" />,
  play: <path d="M7 4l13 8-13 8z" fill="currentColor" stroke="none" />, pause: <path d="M7 4h4v16H7zM14 4h4v16h-4z" fill="currentColor" stroke="none" />,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2" /><path d="M21 16l-5-5-9 9" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />, x: <path d="M6 6l12 12M18 6L6 18" />,
  replay: <path d="M4 12a8 8 0 1 0 3-6.3M4 4v5h5" />, rotate: <path d="M21 12a9 9 0 1 1-3-6.7M21 4v5h-5" />,
  ghost: <path d="M5 21V10a7 7 0 0 1 14 0v11l-3-2-2 2-2-2-2 2-2-2z" />, spark: <path d="M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />,
  plus: <path d="M12 5v14M5 12h14" />, pin: <><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
};
const Icon = ({ n, s = 18 }) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>;

function useHash() {
  const [hash, setHash] = useState(location.hash);
  useEffect(() => { const f = () => setHash(location.hash); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return hash;
}

export default function App() {
  const hash = useHash();
  const auth = useAuth();
  const [local, setLocal] = useState(loadProjects);
  const [cloud, setCloud] = useState(null); // null until the signed-in user's projects are loaded
  const userId = auth.user?.id;
  useEffect(() => {
    if (!userId) { setCloud(null); return; }
    let dead = false;
    listProjects().then((l) => !dead && setCloud(l)).catch(() => !dead && setCloud([]));
    return () => { dead = true; };
  }, [userId]);
  const loading = auth.loading || (!!userId && cloud === null);
  const projects = userId ? cloud || [] : local;
  const [gen, setGen] = useState(null);
  const [lastReq, setLastReq] = useState(null); // keep the form filled if generation fails
  const [qa, setQa] = useState(null); // clarifying questions step
  useEffect(() => setQa(null), [hash]); // navigating away leaves the questions screen
  const id = /^#\/p\/(.+)$/.exec(hash)?.[1];
  const raw = id === 'demo' ? DEMO_PLAN : projects.find((p) => p.id === id)?.plan;
  const plan = useMemo(() => (raw ? normalizePlan(raw) : null), [raw]);

  const saveLocal = (list) => { setLocal(list); if (!store.set(PKEY, list)) alert('האחסון בדפדפן מלא — הפרויקט מוצג אך לא נשמר.'); };

  const generate = async (req) => {
    const ctrl = new AbortController();
    setLastReq(req);
    setGen({ ...req, log: [], parts: 0, steps: 0, started: Date.now(), ctrl, error: null });
    try {
      const out = await requestPlan(req, (ev, d) => setGen((g) => g && ({
        ...g,
        log: ev === 'status' && g.log.at(-1)?.text !== d.text ? [...g.log, d].slice(-8) : g.log,
        parts: ev === 'progress' ? d.parts : g.parts, steps: ev === 'progress' ? d.steps : g.steps,
        title: ev === 'progress' && d.title ? d.title : g.title,
      })), ctrl.signal);
      let pid;
      if (userId) {
        try { const row = await addProject(out); setCloud((c) => [row, ...(c || [])]); pid = row.id; } catch { alert('השמירה בחשבון נכשלה. הפרויקט נשמר בדפדפן הזה בלבד.'); }
      }
      if (!pid) { pid = Date.now().toString(36); saveLocal([{ id: pid, createdAt: Date.now(), plan: out }, ...loadProjects()]); }
      setGen(null);
      setLastReq(null);
      location.hash = `#/p/${pid}`;
    } catch (e) {
      if (ctrl.signal.aborted) return setGen(null);
      setGen((g) => g && { ...g, error: e.message });
    }
  };

  const ask = async (req) => {
    const ctrl = new AbortController();
    setLastReq(req);
    setQa({ req, loading: true, ctrl });
    try {
      const q = await requestQuestions(req, ctrl.signal);
      if (!q.questions.length) { setQa(null); return generate(req); }
      setQa((cur) => cur && { req, ...q });
    } catch (e) {
      if (!ctrl.signal.aborted) setQa((cur) => cur && { req, error: e.message });
    }
  };

  const remove = (pid) => {
    if (!userId) return saveLocal(local.filter((p) => p.id !== pid));
    deleteProject(pid).then(() => setCloud((c) => c.filter((p) => p.id !== pid))).catch(() => alert('המחיקה נכשלה. נסו שוב.'));
  };
  if (id && id !== 'demo' && loading) return <div className="gen"><header className="topbar"><Brand /></header><div className="gen-body"><p className="muted">טוענים את הפרויקט…</p></div></div>;
  if (gen) return <Generating gen={gen} onCancel={() => { gen.ctrl.abort(); setGen(null); }} />;
  if (qa) return <Questions qa={qa} onBack={() => { qa.ctrl?.abort(); setQa(null); }} onDone={(answers) => { setQa(null); generate({ ...qa.req, answers }); }} />;
  if (plan) return <Project key={id} id={id} plan={plan} />;
  return <Home initial={lastReq} projects={projects} auth={auth} onGenerate={ask} onDelete={remove} />;
}

/* ================= HOME ================= */
function Brand() {
  return (
    <a className="brand" href="#/">
      <svg width="40" height="40" viewBox="0 0 48 48" aria-hidden="true"><path d="M24 4l18 10v20L24 44 6 34V14z" fill="#ff6a2b" stroke="#1d1b18" strokeWidth="3" strokeLinejoin="round" /><path d="M6 14l18 10 18-10M24 24v20" fill="none" stroke="#1d1b18" strokeWidth="3" strokeLinejoin="round" /></svg>
      <span><b>סדנה</b><small>מדריכי הרכבה בתלת־ממד</small></span>
    </a>
  );
}

function Home({ initial, projects, auth, onGenerate, onDelete }) {
  const [prompt, setPrompt] = useState(initial?.prompt || '');
  const [image, setImage] = useState(initial?.image || null);
  const [city, setCity] = useState(() => store.get('sadna-city', ''));
  const [drag, setDrag] = useState(false);
  const [difficulty, setDifficulty] = useState(() => initial?.difficulty || store.get('sadna-difficulty', 'קל'));
  const [budget, setBudget] = useState(() => initial?.budget || store.get('sadna-budget', 'זול'));
  const fileRef = useRef();

  const pick = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    try { setImage(await fileToImage(file)); } catch { alert('לא הצלחתי לקרוא את התמונה. נסה קובץ JPG או PNG.'); }
  };
  const submit = (e) => {
    e.preventDefault();
    if (!prompt.trim() && !image) return;
    store.set('sadna-city', city); store.set('sadna-difficulty', difficulty); store.set('sadna-budget', budget);
    onGenerate({ prompt, image, city, difficulty, budget });
  };

  return (
    <div className="home">
      <div className="home-stage"><BgModel /></div>
      <header className="topbar"><Brand /><div className="top-actions"><AuthButton auth={auth} /><a className="pill-link gl" href="#projects">הפרויקטים שלי</a></div></header>
      <section className="hero">
        <form className={`composer gl ${drag ? 'drag' : ''}`} onSubmit={submit}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}>
          <div>
            <span className="eyebrow"><Icon n="spark" s={14} /> חוברת הרכבה תלת־ממדית, מבוססת AI</span>
            <h1>מה בונים היום?</h1>
            <p className="lead">תארו רהיט או העלו תמונה. מקבלים מודל תלת־ממדי, הוראות לכל שלב, רשימת חיתוך ומחירים מחנויות באזור שלכם.</p>
          </div>
          <label className="sr" htmlFor="prompt">מה תרצה לבנות?</label>
          <textarea id="prompt" value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
            placeholder="לדוגמה: ארון נעליים מעץ אורן, רוחב 80, גובה 100, עם 3 מדפים ודלתות..."
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit(e); }} />
          {image && (
            <div className="thumb"><img src={image.preview} alt="התמונה שהועלתה" />
              <button type="button" className="icon-btn" onClick={() => setImage(null)} aria-label="הסר תמונה"><Icon n="x" s={14} /></button></div>
          )}
          <div className="levels">
            <Seg label="רמת קושי" options={DIFFICULTIES} value={difficulty} onChange={setDifficulty} />
            <Seg label="תקציב" options={BUDGETS} value={budget} onChange={setBudget} />
          </div>
          <div className="composer-row">
            <button type="button" className="ghost-btn" onClick={() => fileRef.current.click()}><Icon n="image" /> {image ? 'החלף תמונה' : 'העלה תמונה'}</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files[0])} />
            <label className="city"><Icon n="pin" s={16} /><span className="sr">עיר לחיפוש מחירים</span>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="עיר (למחירים)" maxLength={60} /></label>
            <button className="primary" disabled={!prompt.trim() && !image}>צור מדריך <Icon n="next" /></button>
          </div>
          <div className="chips">{EXAMPLES.map((x) => <button type="button" key={x} onClick={() => setPrompt(x)}>{x}</button>)}</div>
        </form>
        <span className="drag-hint"><Icon n="rotate" s={18} /> גוררים את המודל לסיבוב</span>
      </section>

      <section className="library" id="projects">
        <h2>הפרויקטים שלי</h2>
        <div className="cards">
          <ProjectCard id="demo" plan={DEMO_PLAN} badge="דוגמה" />
          {projects.map((p) => <ProjectCard key={p.id} id={p.id} plan={p.plan} date={p.createdAt} onDelete={() => confirm(`למחוק את "${p.plan.title}"?`) && onDelete(p.id)} />)}
          <a href="#/" className="new-card" onClick={(e) => { e.preventDefault(); document.getElementById('prompt')?.focus(); scrollTo({ top: 0, behavior: 'smooth' }); }}><span><Icon n="plus" s={22} /></span>פרויקט חדש</a>
        </div>
      </section>
    </div>
  );
}

function ProjectCard({ id, plan: raw, badge, date, onDelete }) {
  const plan = useMemo(() => normalizePlan(raw), [raw]);
  const t = totals(plan);
  return (
    <div className="card gl">
      <a href={`#/p/${id}`} className="card-link">
        <div className="card-top">{badge && <span className="badge">{badge}</span>}<span className={`lvl l${DIFFICULTIES.indexOf(plan.difficulty)}`}>{plan.difficulty}</span></div>
        <h3>{plan.title}</h3>
        <p>{plan.summary}</p>
        <div className="card-meta"><span>{plan.steps.length} שלבים</span><span>{plan.parts.length} חלקים</span><b>{fmtILS(t.materials)}</b></div>
        {date && <time>{new Date(date).toLocaleDateString('he-IL')}</time>}
      </a>
      {onDelete && <button className="icon-btn del" onClick={onDelete} aria-label="מחק פרויקט"><Icon n="trash" s={15} /></button>}
    </div>
  );
}

function AuthButton({ auth }) {
  const [open, setOpen] = useState(false);
  if (!cloudEnabled || auth.loading) return null;
  if (auth.user) {
    const email = auth.user.email || '';
    return (
      <div className="auth-user gl">
        <span className="auth-avatar" aria-hidden="true">{email.slice(0, 1).toUpperCase()}</span>
        <span className="auth-email" dir="ltr">{email}</span>
        <button type="button" onClick={() => signOut()}>התנתקות</button>
      </div>
    );
  }
  return (
    <>
      <button type="button" className="pill-link gl" onClick={() => setOpen(true)}>התחברות</button>
      {open && <AuthDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function AuthDialog({ onClose }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState({ s: 'idle' });
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const run = async (fn, okText) => {
    setStatus({ s: 'busy' });
    try { await fn(); setStatus({ s: 'ok', text: okText }); } catch (e) { setStatus({ s: 'err', text: e.message || 'משהו השתבש. נסו שוב.' }); }
  };
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal gl" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <button type="button" className="icon-btn modal-x" onClick={onClose} aria-label="סגור"><Icon n="x" s={14} /></button>
        <div><h2 id="auth-title">התחברות</h2><p className="muted">התחברו כדי לשמור את הפרויקטים בחשבון ולפתוח אותם מכל מכשיר.</p></div>
        <button type="button" className="primary dark" onClick={() => run(signInGoogle, '')} disabled={status.s === 'busy'}>המשך עם Google</button>
        <span className="or">או</span>
        <form onSubmit={(e) => { e.preventDefault(); email.trim() && run(() => signInEmail(email.trim()), 'שלחנו קישור כניסה לאימייל שלכם. לחצו עליו כדי להתחבר.'); }}>
          <label className="sr" htmlFor="auth-email">אימייל</label>
          <input id="auth-email" type="email" required autoFocus dir="ltr" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button className="ghost-btn" disabled={status.s === 'busy'}>שלחו לי קישור</button>
        </form>
        {status.text && <p className={status.s === 'err' ? 'err' : 'ok-note'} role="status">{status.text}</p>}
      </div>
    </div>
  );
}

function Seg({ label, options, value, onChange }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      <span>{label}</span>
      <div>{options.map((o) => <button type="button" key={o} role="radio" aria-checked={value === o} className={value === o ? 'on' : ''} onClick={() => onChange(o)}>{o}</button>)}</div>
    </div>
  );
}

/* ================= QUESTIONS ================= */
function Questions({ qa, onBack, onDone }) {
  const [answers, setAnswers] = useState({});
  const [other, setOther] = useState({});
  const collect = () => (qa.questions || [])
    .map((q, i) => ({ q: String(q.question).slice(0, 290), a: (other[i]?.trim() || answers[i] || '').slice(0, 400) }))
    .filter((x) => x.a);
  return (
    <div className="gen">
      <header className="topbar"><Brand /><button className="pill-link gl" onClick={onBack}>חזרה לתיאור</button></header>
      <div className="gen-body qa-body">
      <div className="gen-card qa-card gl">
        {qa.loading ? (
          <>
            <h2>רגע, כמה שאלות קצרות…</h2>
            <p className="muted">ה-AI בודק מה חסר כדי לתכנן בדיוק.</p>
            <button className="ghost-btn" onClick={onBack}>ביטול</button>
          </>
        ) : qa.error ? (
          <>
            <h2>לא הצלחתי להכין שאלות</h2>
            <p className="err">{qa.error}</p>
            <div className="qa-actions"><button className="ghost-btn" onClick={onBack}>חזרה</button><button className="primary" onClick={() => onDone([])}>צור בלי שאלות</button></div>
          </>
        ) : (
          <>
            <h2>כמה שאלות לדיוק</h2>
            {qa.understanding && <p className="muted">{qa.understanding}</p>}
            <div className="qa-meta"><span className="stat">קושי: {qa.req.difficulty}</span><span className="stat">תקציב: {qa.req.budget}</span></div>
            <ol className="qa-list">
              {qa.questions.map((q, i) => (
                <li key={i}>
                  <b>{q.question}</b>
                  <div className="chips">
                    {(q.options || []).map((o) => (
                      <button type="button" key={o} className={answers[i] === o && !other[i] ? 'on' : ''} aria-pressed={answers[i] === o && !other[i]}
                        onClick={() => { setAnswers({ ...answers, [i]: answers[i] === o ? '' : o }); setOther({ ...other, [i]: '' }); }}>{o}</button>
                    ))}
                  </div>
                  <input className="qa-other" placeholder="אחר / פירוט…" value={other[i] || ''} maxLength={300}
                    onChange={(e) => setOther({ ...other, [i]: e.target.value })} aria-label={'תשובה חופשית: ' + q.question} />
                </li>
              ))}
            </ol>
            <div className="qa-actions">
              <button className="ghost-btn" onClick={onBack}>חזרה</button>
              <button className="ghost-btn" onClick={() => onDone([])}>דלג על השאלות</button>
              <button className="primary" onClick={() => onDone(collect())}>צור מדריך <Icon n="next" /></button>
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

/* ================= GENERATING ================= */
function Generating({ gen, onCancel }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 500); return () => clearInterval(t); }, []);
  const sec = Math.floor((now - gen.started) / 1000);
  return (
    <div className="gen">
      {!gen.error && <div className="home-stage"><BgModel cycle /></div>}
      <header className="topbar"><Brand /></header>
      <div className="gen-body">
      <div className="gen-card gl" role="status" aria-live="polite">
        {gen.error ? (
          <>
            <h2>משהו השתבש</h2>
            <p className="err">{gen.error}</p>
            <button className="primary" onClick={onCancel}>חזרה</button>
          </>
        ) : (
          <>
            <div><span className="lbl">זה לוקח בדרך כלל 1–4 דקות</span>
            <h2>{gen.title || 'מתכננים את הפרויקט שלכם'}</h2></div>
            <div className="gen-stats">
              <div><b>{gen.parts}</b><small>חלקים</small></div>
              <div><b>{gen.steps}</b><small>שלבים</small></div>
              <div><b>{Math.floor(sec / 60)}:{String(sec % 60).padStart(2, '0')}</b><small>זמן</small></div>
            </div>
            <ul className="log">{gen.log.map((l, i) => <li key={i} className={i === gen.log.length - 1 ? 'cur' : ''}>{l.text}</li>)}</ul>
            <button className="ghost-btn" onClick={onCancel}>ביטול</button>
          </>
        )}
      </div>
      </div>
    </div>
  );
}

/* Decorative 3D model behind home / generating screens (the demo project). */
const DEMO_NORMALIZED = normalizePlan(DEMO_PLAN);
function BgModel({ cycle }) {
  const last = DEMO_NORMALIZED.steps.length - 1;
  const [step, setStep] = useState(cycle ? 0 : last);
  useEffect(() => {
    if (!cycle) return;
    const t = setInterval(() => setStep((s) => (s >= last ? 0 : s + 1)), 2400);
    return () => clearInterval(t);
  }, [cycle, last]);
  return (
    <Suspense fallback={null}>
      <Viewer3D plan={DEMO_NORMALIZED} step={step} explode={cycle ? 0 : 0.2} ghost={false} autoRotate replay={0} selected={null} onSelect={() => {}} />
    </Suspense>
  );
}

/* ================= PROJECT ================= */
function Project({ id, plan: basePlan }) {
  const [custom, setCustom] = useState(() => ({ ...DEFAULT_CUSTOM, ...store.get(`sadna-custom-${id}`, {}) }));
  const updateCustom = (patch) => setCustom((c) => { const n = { ...c, ...patch }; store.set(`sadna-custom-${id}`, n); return n; });
  const plan = useMemo(() => applyCustom(basePlan, custom), [basePlan, custom]);
  const [step, setStep] = useState(-1);
  const [tab, setTab] = useState('steps');
  const [explode, setExplode] = useState(0);
  const [ghost, setGhost] = useState(false);
  const [autoRotate, setAutoRotate] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [replay, setReplay] = useState(0);
  const [selected, setSelected] = useState(null);
  const [done, setDone] = useState(() => store.get(`sadna-done-${id}`, []));
  const last = plan.steps.length - 1;
  const t = totals(plan);

  const go = useCallback((n) => setStep(Math.max(-1, Math.min(last, n))), [last]);
  useEffect(() => {
    if (!playing) return;
    if (step >= last) { setPlaying(false); return; }
    const tm = setTimeout(() => go(step + 1), step < 0 ? 2500 : 4200);
    return () => clearTimeout(tm);
  }, [playing, step, last, go]);
  useEffect(() => {
    const k = (e) => {
      if (e.target.closest('input,textarea')) return;
      if (e.key === 'ArrowLeft') { setPlaying(false); go(step + 1); }
      if (e.key === 'ArrowRight') { setPlaying(false); go(step - 1); }
    };
    addEventListener('keydown', k); return () => removeEventListener('keydown', k);
  }, [step, go]);
  const toggleDone = (i) => { const d = done.includes(i) ? done.filter((x) => x !== i) : [...done, i]; setDone(d); store.set(`sadna-done-${id}`, d); };

  const cur = plan.steps[step];
  const newParts = step >= 0 ? stepParts(plan, step) : [];
  const sel = selected && plan.parts.find((p) => p.id === selected);
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
          {[['steps', 'בנייה'], ['custom', 'התאמה'], ['shop', 'קניות'], ['cuts', 'חיתוכים'], ['tools', 'כלים']].map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{l}</button>
          ))}
        </nav>
        <button className="price-pill gl" onClick={() => setTab('shop')}><b>{fmtILS(t.materials)}</b><span>חומרים</span></button>
      </header>

      {tab === 'steps' ? (
        <aside className="now gl" key={step}>
          {step < 0 ? (
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
            <div className="stepbar-title">{step < 0 ? 'מה יש בקופסה' : `שלב ${step + 1} · ${cur.title}`}</div>
            <div className="dots">
              {[-1, ...plan.steps.keys()].map((i) => <button key={i} className={i < step ? 'done' : i === step ? 'cur' : ''} onClick={() => { setPlaying(false); go(i); }} aria-label={i < 0 ? 'מה יש בקופסה' : `שלב ${i + 1}: ${plan.steps[i].title}`} title={i < 0 ? 'מה יש בקופסה' : plan.steps[i].title} />)}
            </div>
          </div>
          <button className="nav" onClick={() => { if (step >= last) go(-1); setPlaying(!playing); }} aria-label={playing ? 'עצור' : 'נגן הרכבה'}><Icon n={playing ? 'pause' : 'play'} s={18} /></button>
          <button className="nav" onClick={() => { setPlaying(false); go(step - 1); }} disabled={step < 0} aria-label="שלב קודם"><Icon n="prev" s={20} /></button>
        </div>
      </div>
    </div>
  );
}

function Swatches({ label, options, value, onPick }) {
  return (
    <div className="cz-group" role="radiogroup" aria-label={label}>
      <span className="lbl">{label}</span>
      <div className="swatches">
        {options.map((o) => (
          <button key={o.key} type="button" role="radio" aria-checked={value === o.key} className={value === o.key ? 'on' : ''} onClick={() => onPick(o.key)}>
            {o.color ? <i style={{ background: o.color }} /> : null}{o.name}
          </button>
        ))}
      </div>
    </div>
  );
}

function CustomizePane({ base, custom, update }) {
  const d0 = baseDims(base), d = custom.dims || d0;
  const hasDims = d0.width > 0 && d0.depth > 0 && d0.height > 0;
  const hasWood = base.parts.some((p) => WOOD_MATERIALS.has(p.material));
  const hasMetal = base.parts.some((p) => METAL_MATERIALS.has(p.material));
  const setDim = (k, v) => update({ dims: { ...d, [k]: +v } });
  return (
    <>
      <div className="cz-head"><h4>התאמה אישית</h4>
        {isCustomized(custom) && <button className="ghost-btn" onClick={() => update({ ...DEFAULT_CUSTOM })}>איפוס</button>}</div>
      {hasDims && (
        <div className="cz-group">
          <span className="lbl">מידות (ס״מ)</span>
          {[['width', 'רוחב'], ['depth', 'עומק'], ['height', 'גובה']].map(([k, l]) => (
            <label key={k} className="cz-dim"><span>{l}</span>
              <input type="range" min={Math.round(d0[k] * 0.5)} max={Math.round(d0[k] * 2)} step="1" value={Math.round(d[k])} onChange={(e) => setDim(k, e.target.value)} />
              <output>{Math.round(d[k])}</output></label>
          ))}
          <p className="fine">הפרופילים והלוחות שומרים על העובי שלהם, ורק האורך נמתח. רשימות הקניות והחיתוכים מתייחסות למידות המקוריות.</p>
        </div>
      )}
      {hasWood && <Swatches label="סוג עץ" options={WOOD_TONES} value={custom.wood} onPick={(k) => update({ wood: k })} />}
      {hasWood && <Swatches label="גימור עץ" options={WOOD_FINISHES} value={custom.woodFinish} onPick={(k) => update({ woodFinish: k })} />}
      {hasMetal && <Swatches label="גימור מתכת" options={METAL_FINISHES} value={custom.metal} onPick={(k) => update({ metal: k })} />}
      {!hasDims && !hasWood && !hasMetal && <p className="fine">אין מה להתאים בפרויקט הזה.</p>}
    </>
  );
}

function PartInfo({ plan, part, onClose }) {
  const g = groupOf(plan, part.id);
  const [l, w, t] = [...partDims(part)].sort((a, b) => b - a);
  const round = part.shape === 'cylinder' || part.shape === 'tube';
  return (
    <div className="part-info" role="dialog" aria-label={part.name}>
      <button className="icon-btn" onClick={onClose} aria-label="סגור"><Icon n="x" s={14} /></button>
      <h3><span className="tag3d">{g.letter}</span> {part.name}</h3>
      <dl>
        <dt>אורך</dt><dd>{fmtCm(l)}</dd>
        <dt>{round ? 'קוטר' : 'רוחב'}</dt><dd>{fmtCm(w)}</dd>
        {!round && <><dt>עובי</dt><dd>{fmtCm(t)}</dd></>}
        <dt>חומר</dt><dd>{materialName(part.material)}</dd>
        <dt>כמות</dt><dd>{g.ids.length}</dd>
        <dt>מותקן בשלב</dt><dd>{part.step + 1}</dd>
      </dl>
    </div>
  );
}

function ShopPane({ plan }) {
  const t = totals(plan);
  const anyEst = plan.shopping.some((s) => s.estimated);
  return (
    <>
      <div className="total-box">
        <div><small>עלות חומרים משוערת</small><b>{fmtILS(t.materials)}</b></div>
        {t.tools > 0 && <div><small>אם צריך לקנות את כל הכלים</small><b className="muted">+{fmtILS(t.tools)}</b></div>}
      </div>
      {plan.simplifications.length > 0 && (
        <div className="note tip simp"><b>איך הוזל ופושט הפרויקט</b><ul>{plan.simplifications.map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      )}
      {plan.stores.length > 0 && (
        <>
          <h4>איפה לקנות</h4>
          <ul className="stores">{plan.stores.map((st, i) => (
            <li key={i}>
              <div className="store-hd">
                {st.url ? <a href={st.url} target="_blank" rel="noreferrer noopener"><b>{st.name}</b></a> : <b>{st.name}</b>}
                {st.cutService && <span className="cut-badge">✂ חיתוך לפי מידה</span>}
              </div>
              {st.location && <small>{st.location}</small>}
              {st.sells && <p>{st.sells}</p>}
              {st.note && <small>{st.note}</small>}
            </li>
          ))}</ul>
          <h4>רשימת קניות</h4>
        </>
      )}
      <table className="tbl">
        <thead><tr><th>פריט</th><th>כמות</th><th>מחיר</th></tr></thead>
        <tbody>
          {plan.shopping.map((s, i) => (
            <tr key={i}>
              <td><b>{s.item}</b>{s.spec && <small>{s.spec}</small>}
                <small className="store">{s.url ? <a href={s.url} target="_blank" rel="noreferrer noopener">{s.store || 'קישור'}</a> : s.store}{s.estimated && <em> · הערכה</em>}</small></td>
              <td className="q">{s.qty} {s.unit}</td>
              <td className="q">{fmtILS(s.qty * s.unitPrice)}<small>{fmtILS(s.unitPrice)} ליח׳</small></td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={2}>סה״כ</td><td className="q">{fmtILS(t.materials)}</td></tr></tfoot>
      </table>
      <p className="fine">{plan.priceNote || (anyEst ? 'חלק מהמחירים הם הערכה.' : '')} המחירים משתנים בין חנויות — כדאי לבדוק לפני הקנייה.</p>
      {plan.sources.length > 0 && (
        <details className="sources"><summary>מקורות המחירים ({plan.sources.length})</summary>
          <ul>{plan.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noreferrer noopener">{s.title}</a></li>)}</ul>
        </details>
      )}
    </>
  );
}

function CutsPane({ plan }) {
  if (!plan.cutList.length) return <p className="fine">אין רשימת חיתוך לפרויקט הזה.</p>;
  const colors = ['#d9a066', '#c98b52', '#e3b47c', '#b97a45', '#edc794', '#a86d3c'];
  const names = [...new Set(plan.cutList.flatMap((b) => b.cuts.map((c) => c.name)))];
  return (
    <>
      <p className="fine">כל פס הוא חומר גלם אחד לקנייה. האזורים המקווקווים הם פחת. עובי מסור 3 מ״מ.</p>
      {plan.cutList.map((b, bi) => {
        const sheet = b.stockWidth > 0 && b.cuts.some((c) => c.width > 0);
        const used = b.cuts.reduce((s, c) => s + c.length, 0) + b.cuts.length * 0.3;
        return (
          <div key={bi} className="board">
            <div className="board-hd"><b>{b.stock}</b><small>{b.stockLength}{sheet ? `×${b.stockWidth}` : ''} ס״מ{!sheet && ` · נשאר ${fmtCm(Math.max(0, b.stockLength - used))}`}</small></div>
            {sheet ? <SheetSvg board={b} colors={colors} names={names} /> : (
              <svg viewBox={`0 0 ${b.stockLength} 14`} className="bar" preserveAspectRatio="none" role="img" aria-label={`תוכנית חיתוך ל${b.stock}`}>
                <defs><pattern id={`w${bi}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#efe6d6" /><line y2="4" stroke="#cdbb9c" strokeWidth="1.5" /></pattern></defs>
                <rect width={b.stockLength} height="14" fill={`url(#w${bi})`} />
                {b.cuts.reduce((acc, c, i) => {
                  const x = acc.x;
                  acc.els.push(<rect key={i} x={x} width={c.length} height="14" fill={colors[names.indexOf(c.name) % colors.length]} stroke="#5b3d22" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />);
                  acc.x += c.length + 0.3; return acc;
                }, { x: 0, els: [] }).els}
              </svg>
            )}
            <ul className="cuts">{b.cuts.map((c, i) => (
              <li key={i}><i style={{ background: colors[names.indexOf(c.name) % colors.length] }} />{c.name} — <b>{fmtCm(c.length)}</b>{c.width > 0 && ` × ${fmtCm(c.width)}`}{c.angle > 0 && c.angle !== 90 && ` · זווית ${c.angle}°`}</li>
            ))}</ul>
          </div>
        );
      })}
    </>
  );
}

function SheetSvg({ board, colors, names }) {
  const placed = packSheet(board);
  return (
    <svg viewBox={`0 0 ${board.stockLength} ${board.stockWidth}`} className="sheet" role="img" aria-label={`תוכנית חיתוך ל${board.stock}`}>
      <rect width={board.stockLength} height={board.stockWidth} fill="#efe6d6" stroke="#cdbb9c" />
      {placed.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} fill={colors[names.indexOf(c.name) % colors.length]} stroke={c.overflow ? '#c0392b' : '#5b3d22'} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          <text x={c.x + c.w / 2} y={c.y + c.h / 2} fontSize={Math.min(c.h * 0.35, board.stockWidth * 0.06)} textAnchor="middle" dominantBaseline="middle" fill="#3b2614">{c.name}</text>
        </g>
      ))}
    </svg>
  );
}

function ToolsPane({ plan }) {
  const ess = plan.tools.filter((t) => t.essential), opt = plan.tools.filter((t) => !t.essential);
  const List = ({ items }) => <ul className="tool-list">{items.map((t) => <li key={t.name}><div><b>{t.name}</b><small>{t.purpose}</small></div>{t.estPrice > 0 && <span>{fmtILS(t.estPrice)}</span>}</li>)}</ul>;
  return (
    <>
      <h4>חובה</h4><List items={ess} />
      {opt.length > 0 && <><h4>מומלץ</h4><List items={opt} /></>}
      <p className="fine">המחירים לכלים הם הערכה לקנייה חדשה. אפשר גם לשכור או לשאול משכנים 🙂</p>
    </>
  );
}
