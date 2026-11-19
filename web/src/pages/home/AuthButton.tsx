import { useEffect, useState } from 'react';
import { cloudEnabled, signInEmail, signInGoogle, signOut, type Auth } from '../../cloud/cloud';
import { Icon } from '../../components/Icon';

export function AuthButton({ auth }: { auth: Auth }) {
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

type Status = { s: 'idle' | 'busy' | 'ok' | 'err'; text?: string };

function AuthDialog({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>({ s: 'idle' });
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  const run = async (fn: () => Promise<void>, okText: string) => {
    setStatus({ s: 'busy' });
    try { await fn(); setStatus({ s: 'ok', text: okText }); } catch (e) { setStatus({ s: 'err', text: (e as Error).message || 'משהו השתבש. נסו שוב.' }); }
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
