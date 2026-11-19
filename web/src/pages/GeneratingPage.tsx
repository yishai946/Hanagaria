import { useEffect, useState } from 'react';
import type { PlanRequest } from '../api/plan.api';
import { BgModel } from '../components/BgModel';
import { Brand } from '../components/Brand';

export type GenState = PlanRequest & {
  log: { stage: string; text: string }[]; parts: number; steps: number; title?: string;
  started: number; ctrl: AbortController; error: string | null;
};

export function GeneratingPage({ gen, onCancel }: { gen: GenState; onCancel: () => void }) {
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
