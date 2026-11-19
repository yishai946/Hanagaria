import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { currentCity, searchCities, type Suggestion } from '../../api/places.api';
import { saveCity, signOut, userCity, type Auth } from '../../cloud/cloud';
import { Icon } from '../../components/Icon';
import { applyTheme, useTheme } from '../../lib/theme';

type Note = { kind: 'ok' | 'err'; text: string } | null;

export function ProfileMenu({ auth }: { auth: Auth }) {
  const user = auth.user!;
  const email = user.email || '';
  const saved = userCity(user);
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const [city, setCity] = useState(saved);
  const [options, setOptions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(-1);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const typed = useRef(false); // only search while the user is typing, not after a pick

  useEffect(() => { setCity(saved); }, [saved]);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const esc = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    addEventListener('mousedown', away); addEventListener('keydown', esc);
    return () => { removeEventListener('mousedown', away); removeEventListener('keydown', esc); };
  }, [open]);

  // Debounced autocomplete.
  useEffect(() => {
    const q = city.trim();
    if (!typed.current || q.length < 2) { setOptions([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      searchCities(q, ctrl.signal).then((r) => { setOptions(r); setActive(-1); }).catch(() => {});
    }, 450);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [city]);

  const save = async (value: string) => {
    typed.current = false;
    setCity(value); setOptions([]); setBusy(true);
    try { await saveCity(value); setNote({ kind: 'ok', text: value.trim() ? 'העיר נשמרה' : 'העיר נמחקה' }); }
    catch (e) { setNote({ kind: 'err', text: (e as Error).message || 'השמירה נכשלה. נסו שוב.' }); }
    finally { setBusy(false); }
  };

  const locate = async () => {
    setBusy(true); setNote(null);
    try { await save(await currentCity()); }
    catch { setBusy(false); setNote({ kind: 'err', text: 'לא הצלחתי לזהות מיקום. אשרו גישה למיקום או הקלידו עיר.' }); }
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(options.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(-1, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); void save(options[active]?.city ?? city); }
  };

  return (
    <div className="profile" ref={root}>
      <button type="button" className="avatar-btn" onClick={() => setOpen(!open)} aria-haspopup="dialog" aria-expanded={open} aria-label="הפרופיל שלי">
        {email.slice(0, 1).toUpperCase() || '?'}
      </button>
      {open && (
        <div className="menu gl" role="dialog" aria-label="הפרופיל שלי">
          <div className="menu-email" dir="ltr">{email}</div>
          <div className="menu-field">
            <label className="lbl" htmlFor="my-city">העיר שלי</label>
            <div className="row">
              <input id="my-city" role="combobox" aria-expanded={options.length > 0} aria-controls="city-options" aria-autocomplete="list"
                autoComplete="off" value={city} maxLength={60} placeholder="הקלידו עיר…" onKeyDown={onKey}
                onChange={(e) => { typed.current = true; setCity(e.target.value); setNote(null); }} />
              <button type="button" className="icon-btn" onClick={locate} disabled={busy} aria-label="השתמש במיקום הנוכחי" title="המיקום הנוכחי שלי"><Icon n="locate" s={18} /></button>
            </div>
            {options.length > 0 && (
              <ul className="suggest" id="city-options" role="listbox">
                {options.map((o, i) => (
                  <li key={o.city} role="option" aria-selected={i === active} onMouseDown={(e) => { e.preventDefault(); void save(o.city); }}>
                    {o.city}{o.detail && <small>{o.detail}</small>}
                  </li>
                ))}
              </ul>
            )}
            <p className={`menu-hint ${note?.kind === 'err' ? 'err' : ''}`} role="status">
              {note?.text ?? 'ברירת המחדל לחיפוש חנויות ומחירים. Enter לשמירה.'}
            </p>
          </div>
          <hr className="menu-sep" />
          <div className="menu-row">
            <span><Icon n={theme === 'dark' ? 'moon' : 'sun'} s={18} /> מצב כהה</span>
            <button type="button" className="switch" role="switch" aria-checked={theme === 'dark'} aria-label="מצב כהה"
              onClick={() => applyTheme(theme === 'dark' ? 'light' : 'dark')} />
          </div>
          <hr className="menu-sep" />
          <button type="button" className="menu-item" onClick={() => signOut()}><Icon n="logout" s={18} /> התנתקות</button>
        </div>
      )}
    </div>
  );
}
