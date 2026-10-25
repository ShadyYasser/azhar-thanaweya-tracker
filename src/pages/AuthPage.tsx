import { useState, type FormEvent } from 'react';
import { siteUrl, supabase } from '../lib/supabase';

type Mode = 'login' | 'signup';

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'الإيميل أو كلمة السر غير صحيحة.';
  if (m.includes('email not confirmed')) return 'لازم تأكد الإيميل الأول من الرسالة اللي وصلتك.';
  if (m.includes('already registered')) return 'الإيميل ده مسجّل قبل كده. سجّل دخول بدل إنشاء حساب.';
  if (m.includes('password')) return 'كلمة السر لازم تكون 6 حروف على الأقل.';
  if (m.includes('rate limit')) return 'محاولات كتير ورا بعض. استنى شوية وجرّب تاني.';
  return message;
}

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) setError(translateAuthError(err.message));
    } else {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: siteUrl,
          data: displayName.trim() ? { display_name: displayName.trim() } : undefined,
        },
      });
      if (err) setError(translateAuthError(err.message));
      else if (!data.session) {
        setInfo('تم إنشاء الحساب. افتح الإيميل واضغط على رابط التأكيد، وبعدين سجّل دخول.');
        setMode('login');
      }
    }
    setBusy(false);
  };

  return (
    <div className="center">
      <div className="card narrow">
        <h1 className="title">متابعة الثانوية الأزهرية</h1>
        <p className="muted">تابع مذاكرتك درساً بدرس في كل المواد.</p>

        <div className="tabs" role="tablist">
          <button
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => setMode('login')}
          >
            تسجيل الدخول
          </button>
          <button
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'tab active' : 'tab'}
            onClick={() => setMode('signup')}
          >
            إنشاء حساب
          </button>
        </div>

        <form onSubmit={submit} className="form">
          {mode === 'signup' && (
            <label>
              الاسم (اختياري)
              <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} />
            </label>
          )}
          <label>
            الإيميل
            <input
              type="email"
              dir="ltr"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
          <label>
            كلمة السر
            <input
              type="password"
              dir="ltr"
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error && <p className="error">{error}</p>}
          {info && <p className="info">{info}</p>}
          <button className="btn" type="submit" disabled={busy}>
            {busy ? 'لحظة…' : mode === 'login' ? 'دخول' : 'إنشاء الحساب'}
          </button>
        </form>
      </div>
    </div>
  );
}
