import { useState } from 'react';
import type { Answer, Questions } from '@shared/types';
import type { PlanRequest } from '../api/plan.api';
import { Brand } from '../components/Brand';
import { Icon } from '../components/Icon';

export type QaState = { req: PlanRequest; loading?: boolean; ctrl?: AbortController; error?: string } & Partial<Questions>;

interface Props { qa: QaState; onBack: () => void; onDone: (answers: Answer[]) => void }

export function QuestionsPage({ qa, onBack, onDone }: Props) {
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [other, setOther] = useState<Record<number, string>>({});
  const collect = (): Answer[] => (qa.questions || [])
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
              {(qa.questions || []).map((q, i) => (
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
