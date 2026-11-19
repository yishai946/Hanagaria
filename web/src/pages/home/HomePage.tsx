import { useEffect, useRef, useState, type DragEvent, type FormEvent, type KeyboardEvent } from 'react';
import { BUDGETS, DIFFICULTIES } from '@shared/constants';
import { DEMO_PLAN } from '@shared/demoPlan';
import type { Budget, Difficulty } from '@shared/types';
import { fileToImage, type PlanRequest, type UploadedImage } from '../../api/plan.api';
import { userCity, type Auth, type Project } from '../../cloud/cloud';
import { BgModel } from '../../components/BgModel';
import { Brand } from '../../components/Brand';
import { Icon } from '../../components/Icon';
import { Seg } from '../../components/Seg';
import { store } from '../../lib/storage';
import { AuthButton } from './AuthButton';
import { ProjectCard } from './ProjectCard';

const EXAMPLES = [
  'שולחן קפה מעץ אורן עם מדף תחתון, 110x60 ס״מ',
  'ספסל גינה מקורות אורן מוגן לשני אנשים',
  'מדף קיר תעשייתי מפרופיל ברזל ולוחות עץ',
  'שולחן עבודה לנגרייה עם מדף לכלים',
  'עציץ מוגבה לגינה מעץ, 120x60',
  'מתקן לאופניים מברזל לקיר',
];

interface Props {
  initial: PlanRequest | null;
  projects: Project[];
  auth: Auth;
  onGenerate: (req: PlanRequest) => void;
  onDelete: (id: string) => void;
}

export function HomePage({ initial, projects, auth, onGenerate, onDelete }: Props) {
  const [prompt, setPrompt] = useState(initial?.prompt || '');
  const [image, setImage] = useState<UploadedImage | null>(initial?.image || null);
  const profileCity = userCity(auth.user);
  const [city, setCity] = useState(() => initial?.city || profileCity || store.get('sadna-city', ''));
  const typed = useRef(false); // the profile city is only a default: never overwrite what the user typed
  useEffect(() => { if (profileCity && !typed.current) setCity(profileCity); }, [profileCity]);
  const [drag, setDrag] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>(() => initial?.difficulty || store.get<Difficulty>('sadna-difficulty', 'קל'));
  const [budget, setBudget] = useState<Budget>(() => initial?.budget || store.get<Budget>('sadna-budget', 'זול'));
  const fileRef = useRef<HTMLInputElement>(null);

  const pick = async (file: File | undefined) => {
    if (!file || !file.type.startsWith('image/')) return;
    try { setImage(await fileToImage(file)); } catch { alert('לא הצלחתי לקרוא את התמונה. נסה קובץ JPG או PNG.'); }
  };
  const submit = (e: FormEvent | KeyboardEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !image) return;
    store.set('sadna-city', city); store.set('sadna-difficulty', difficulty); store.set('sadna-budget', budget);
    onGenerate({ prompt, image, city, difficulty, budget });
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); };

  return (
    <div className="home">
      <div className="home-stage"><BgModel /></div>
      <header className="topbar"><Brand /><div className="top-actions"><AuthButton auth={auth} /><a className="pill-link gl" href="#projects">הפרויקטים שלי</a></div></header>
      <section className="hero">
        <form className={`composer gl ${drag ? 'drag' : ''}`} onSubmit={submit}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}>
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
            <button type="button" className="ghost-btn" onClick={() => fileRef.current?.click()}><Icon n="image" /> {image ? 'החלף תמונה' : 'העלה תמונה'}</button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} />
            <label className="city"><Icon n="pin" s={16} /><span className="sr">עיר לחיפוש מחירים</span>
              <input value={city} onChange={(e) => { typed.current = true; setCity(e.target.value); }} placeholder="עיר (למחירים)" maxLength={60} /></label>
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
          {projects.map((p) => <ProjectCard key={p.id} id={p.id} plan={p.plan} date={p.createdAt} onDelete={() => confirm(`למחוק את "${String(p.plan.title)}"?`) && onDelete(p.id)} />)}
          <a href="#/" className="new-card" onClick={(e) => { e.preventDefault(); document.getElementById('prompt')?.focus(); scrollTo({ top: 0, behavior: 'smooth' }); }}><span><Icon n="plus" s={22} /></span>פרויקט חדש</a>
        </div>
      </section>
    </div>
  );
}
