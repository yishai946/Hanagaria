// The side panels of the project page: customize, shopping list, cut list, tools, part info.
import { fmtCm, fmtILS, groupOf, materialName, packSheet, partDims, totals } from '@shared/plan';
import type { CutBoard, Part, Plan } from '@shared/types';
import { Icon } from '../../components/Icon';
import { baseDims, isCustomized } from '../../lib/customize';
import { DEFAULT_CUSTOM, METAL_FINISHES, METAL_MATERIALS, WOOD_FINISHES, WOOD_MATERIALS, WOOD_TONES, type Custom, type Option } from '../../lib/finishes';

function Swatches({ label, options, value, onPick }: { label: string; options: Option[]; value: string; onPick: (key: string) => void }) {
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

export function CustomizePane({ base, custom, update }: { base: Plan; custom: Custom; update: (patch: Partial<Custom>) => void }) {
  const d0 = baseDims(base), d = custom.dims || d0;
  const hasDims = d0.width > 0 && d0.depth > 0 && d0.height > 0;
  const hasWood = base.parts.some((p) => WOOD_MATERIALS.has(p.material));
  const hasMetal = base.parts.some((p) => METAL_MATERIALS.has(p.material));
  const setDim = (k: 'width' | 'depth' | 'height', v: string) => update({ dims: { ...d, [k]: +v } });
  const dimRows = [['width', 'רוחב'], ['depth', 'עומק'], ['height', 'גובה']] as const;
  return (
    <>
      <div className="cz-head"><h4>התאמה אישית</h4>
        {isCustomized(custom) && <button className="ghost-btn" onClick={() => update({ ...DEFAULT_CUSTOM })}>איפוס</button>}</div>
      {hasDims && (
        <div className="cz-group">
          <span className="lbl">מידות (ס״מ)</span>
          {dimRows.map(([k, l]) => (
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

export function PartInfo({ plan, part, onClose }: { plan: Plan; part: Part; onClose: () => void }) {
  const g = groupOf(plan, part.id);
  const [l, w, t] = [...partDims(part)].sort((a, b) => b - a) as [number, number, number];
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

export function ShopPane({ plan }: { plan: Plan }) {
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

export function CutsPane({ plan }: { plan: Plan }) {
  if (!plan.cutList.length) return <p className="fine">אין רשימת חיתוך לפרויקט הזה.</p>;
  const colors = ['#d9a066', '#c98b52', '#e3b47c', '#b97a45', '#edc794', '#a86d3c'];
  const names = [...new Set(plan.cutList.flatMap((b) => b.cuts.map((c) => c.name)))];
  const colorOf = (name: string) => colors[names.indexOf(name) % colors.length]!;
  return (
    <>
      <p className="fine">כל פס הוא חומר גלם אחד לקנייה. האזורים המקווקווים הם פחת. עובי מסור 3 מ״מ.</p>
      {plan.cutList.map((b, bi) => {
        const sheet = b.stockWidth > 0 && b.cuts.some((c) => c.width > 0);
        const used = b.cuts.reduce((s, c) => s + c.length, 0) + b.cuts.length * 0.3;
        let x = 0;
        return (
          <div key={bi} className="board">
            <div className="board-hd"><b>{b.stock}</b><small>{b.stockLength}{sheet ? `×${b.stockWidth}` : ''} ס״מ{!sheet && ` · נשאר ${fmtCm(Math.max(0, b.stockLength - used))}`}</small></div>
            {sheet ? <SheetSvg board={b} colorOf={colorOf} /> : (
              <svg viewBox={`0 0 ${b.stockLength} 14`} className="bar" preserveAspectRatio="none" role="img" aria-label={`תוכנית חיתוך ל${b.stock}`}>
                <defs><pattern id={`w${bi}`} width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="4" height="4" fill="#efe6d6" /><line y2="4" stroke="#cdbb9c" strokeWidth="1.5" /></pattern></defs>
                <rect width={b.stockLength} height="14" fill={`url(#w${bi})`} />
                {b.cuts.map((c, i) => {
                  const at = x;
                  x += c.length + 0.3;
                  return <rect key={i} x={at} width={c.length} height="14" fill={colorOf(c.name)} stroke="#5b3d22" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />;
                })}
              </svg>
            )}
            <ul className="cuts">{b.cuts.map((c, i) => (
              <li key={i}><i style={{ background: colorOf(c.name) }} />{c.name} — <b>{fmtCm(c.length)}</b>{c.width > 0 && ` × ${fmtCm(c.width)}`}{c.angle > 0 && c.angle !== 90 && ` · זווית ${c.angle}°`}</li>
            ))}</ul>
          </div>
        );
      })}
    </>
  );
}

function SheetSvg({ board, colorOf }: { board: CutBoard; colorOf: (name: string) => string }) {
  const placed = packSheet(board);
  return (
    <svg viewBox={`0 0 ${board.stockLength} ${board.stockWidth}`} className="sheet" role="img" aria-label={`תוכנית חיתוך ל${board.stock}`}>
      <rect width={board.stockLength} height={board.stockWidth} fill="#efe6d6" stroke="#cdbb9c" />
      {placed.map((c, i) => (
        <g key={i}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} fill={colorOf(c.name)} stroke={c.overflow ? '#c0392b' : '#5b3d22'} strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          <text x={c.x + c.w / 2} y={c.y + c.h / 2} fontSize={Math.min(c.h * 0.35, board.stockWidth * 0.06)} textAnchor="middle" dominantBaseline="middle" fill="#3b2614">{c.name}</text>
        </g>
      ))}
    </svg>
  );
}

function ToolList({ items }: { items: Plan['tools'] }) {
  return <ul className="tool-list">{items.map((t) => <li key={t.name}><div><b>{t.name}</b><small>{t.purpose}</small></div>{t.estPrice > 0 && <span>{fmtILS(t.estPrice)}</span>}</li>)}</ul>;
}

export function ToolsPane({ plan }: { plan: Plan }) {
  const ess = plan.tools.filter((t) => t.essential), opt = plan.tools.filter((t) => !t.essential);
  return (
    <>
      <h4>חובה</h4><ToolList items={ess} />
      {opt.length > 0 && <><h4>מומלץ</h4><ToolList items={opt} /></>}
      <p className="fine">המחירים לכלים הם הערכה לקנייה חדשה. אפשר גם לשכור או לשאול משכנים 🙂</p>
    </>
  );
}
