import { useEffect, useMemo, useState } from 'react';
import { DEMO_PLAN } from '@shared/demoPlan';
import { normalizePlan } from '@shared/plan';
import type { Answer, RawPlan } from '@shared/types';
import { requestPlan, requestQuestions, type PlanRequest } from './api/plan.api';
import { addProject, deleteProject, listProjects, useAuth, type Project } from './cloud/cloud';
import { Brand } from './components/Brand';
import { store } from './lib/storage';
import { useHash } from './lib/useHash';
import { GeneratingPage, type GenState } from './pages/GeneratingPage';
import { HomePage } from './pages/home/HomePage';
import { ProjectPage } from './pages/project/ProjectPage';
import { QuestionsPage, type QaState } from './pages/QuestionsPage';

const PKEY = 'sadna-projects';
const loadProjects = () => store.get<Project[]>(PKEY, []);

export default function App() {
  const hash = useHash();
  const auth = useAuth();
  const [local, setLocal] = useState(loadProjects);
  const [cloud, setCloud] = useState<Project[] | null>(null); // null until the signed-in user's projects are loaded
  const userId = auth.user?.id;
  useEffect(() => {
    if (!userId) { setCloud(null); return; }
    let dead = false;
    listProjects().then((l) => !dead && setCloud(l)).catch(() => !dead && setCloud([]));
    return () => { dead = true; };
  }, [userId]);
  const loading = auth.loading || (!!userId && cloud === null);
  const projects = userId ? cloud || [] : local;
  const [gen, setGen] = useState<GenState | null>(null);
  const [lastReq, setLastReq] = useState<PlanRequest | null>(null); // keep the form filled if generation fails
  const [qa, setQa] = useState<QaState | null>(null); // clarifying questions step
  useEffect(() => setQa(null), [hash]); // navigating away leaves the questions screen
  const id = /^#\/p\/(.+)$/.exec(hash)?.[1];
  const raw: RawPlan | undefined = id === 'demo' ? DEMO_PLAN : projects.find((p) => p.id === id)?.plan;
  const plan = useMemo(() => (raw ? normalizePlan(raw) : null), [raw]);

  const saveLocal = (list: Project[]) => { setLocal(list); if (!store.set(PKEY, list)) alert('האחסון בדפדפן מלא — הפרויקט מוצג אך לא נשמר.'); };

  const generate = async (req: PlanRequest) => {
    const ctrl = new AbortController();
    setLastReq(req);
    setGen({ ...req, log: [], parts: 0, steps: 0, started: Date.now(), ctrl, error: null });
    try {
      const out = await requestPlan(req, ({ event, data: d }) => setGen((g) => {
        if (!g) return g;
        if (event === 'status') return { ...g, log: g.log.at(-1)?.text !== d.text ? [...g.log, d].slice(-8) : g.log };
        return { ...g, parts: d.parts, steps: d.steps, title: d.title || g.title };
      }), ctrl.signal);
      let pid: string | undefined;
      if (userId) {
        try { const row = await addProject(out); setCloud((c) => [row, ...(c || [])]); pid = row.id; } catch { alert('השמירה בחשבון נכשלה. הפרויקט נשמר בדפדפן הזה בלבד.'); }
      }
      if (!pid) { pid = Date.now().toString(36); saveLocal([{ id: pid, createdAt: Date.now(), plan: out }, ...loadProjects()]); }
      setGen(null);
      setLastReq(null);
      location.hash = `#/p/${pid}`;
    } catch (e) {
      if (ctrl.signal.aborted) return setGen(null);
      setGen((g) => g && { ...g, error: (e as Error).message });
    }
  };

  const ask = async (req: PlanRequest) => {
    const ctrl = new AbortController();
    setLastReq(req);
    setQa({ req, loading: true, ctrl });
    try {
      const q = await requestQuestions(req, ctrl.signal);
      if (!q.questions.length) { setQa(null); return generate(req); }
      setQa((cur) => cur && { req, ...q });
    } catch (e) {
      if (!ctrl.signal.aborted) setQa((cur) => cur && { req, error: (e as Error).message });
    }
  };

  const remove = (pid: string) => {
    if (!userId) return saveLocal(local.filter((p) => p.id !== pid));
    deleteProject(pid).then(() => setCloud((c) => (c || []).filter((p) => p.id !== pid))).catch(() => alert('המחיקה נכשלה. נסו שוב.'));
  };

  if (id && id !== 'demo' && loading) return <div className="gen"><header className="topbar"><Brand /></header><div className="gen-body"><p className="muted">טוענים את הפרויקט…</p></div></div>;
  if (gen) return <GeneratingPage gen={gen} onCancel={() => { gen.ctrl.abort(); setGen(null); }} />;
  if (qa) return <QuestionsPage qa={qa} onBack={() => { qa.ctrl?.abort(); setQa(null); }} onDone={(answers: Answer[]) => { setQa(null); generate({ ...qa.req, answers }); }} />;
  if (plan && id) return <ProjectPage key={id} id={id} plan={plan} />;
  return <HomePage initial={lastReq} projects={projects} auth={auth} onGenerate={ask} onDelete={remove} />;
}
