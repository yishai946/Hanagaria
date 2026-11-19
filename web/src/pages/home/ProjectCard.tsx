import { useMemo } from 'react';
import { DIFFICULTIES } from '@shared/constants';
import { fmtILS, normalizePlan, totals } from '@shared/plan';
import type { RawPlan } from '@shared/types';
import { Icon } from '../../components/Icon';

interface Props { id: string; plan: RawPlan; badge?: string; date?: number; onDelete?: () => void }

export function ProjectCard({ id, plan: raw, badge, date, onDelete }: Props) {
  const plan = useMemo(() => normalizePlan(raw), [raw]);
  const t = totals(plan);
  return (
    <div className="card gl">
      <a href={`#/p/${id}`} className="card-link">
        <div className="card-top">{badge && <span className="badge">{badge}</span>}<span className={`lvl l${DIFFICULTIES.findIndex((d) => d === plan.difficulty)}`}>{plan.difficulty}</span></div>
        <h3>{plan.title}</h3>
        <p>{plan.summary}</p>
        <div className="card-meta"><span>{plan.steps.length} שלבים</span><span>{plan.parts.length} חלקים</span><b>{fmtILS(t.materials)}</b></div>
        {date && <time>{new Date(date).toLocaleDateString('he-IL')}</time>}
      </a>
      {onDelete && <button className="icon-btn del" onClick={onDelete} aria-label="מחק פרויקט"><Icon n="trash" s={15} /></button>}
    </div>
  );
}
