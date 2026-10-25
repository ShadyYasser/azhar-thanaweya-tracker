import { useState, type FormEvent } from 'react';
import { authErrorMessage } from '../lib/authErrors';
import { siteUrl, supabase } from '../lib/supabase';

type Mode = 'login' | 'signup' | 'forgot';

export function AuthPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
    setInfo(null);
    setCanResend(false);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    setCanResend(false);

    if (mode === 'login') {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(authErrorMessage(err));
        setCanResend(err.code === 'email_not_confirmed');
      }
    } else if (mode === 'signup') {
      const { data, error: err } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: siteUrl,
          data: displayName.trim() ? { display_name: displayName.trim() } : undefined,
        },
      });
      if (err) {
        setError(authErrorMessage(err));
      } else if (data.user && data.user.identities?.length === 0) {
        // Supabase answers a signup for an existing address without saying so.
        setError('الإيميل ده مسجّل قبل كده. سجّل دخول، ولو ناسي كلمة السر استخدم "نسيت كلمة السر".');
      } else if (!data.session) {
        setMode('login');
        setInfo('تم إنشاء الحساب. افتح الإيميل واضغط على رابط التأكيد، وبعدين سجّل دخول.');
      }
    } else {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: siteUrl });
      if (err) setError(authErrorMessage(err));
      else setInfo('لو الإيميل ده مسجّل عندنا هتوصلك رسالة فيها رابط لتغيير كلمة السر. افتح الرابط من نفس الجهاز والمتصفح.');
    }
    setBusy(false);
  };

  const resend = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: siteUrl },
    });
    setBusy(false);
    if (err) setError(authErrorMessage(err));
    else {
      setCanResend(false);
      setInfo('بعتنا رسالة التأكيد تاني. شوف الـ Inbox والـ Spam.');
    }
  };

  return (
    <div className="center">
      <div className="card narrow">
        <h1 className="title">متابعة الثانوية الأزهرية</h1>
        <p className="muted">تابع مذاكرتك درساً بدرس في كل المواد.</p>

        {mode === 'forgot' ? (
          <>
            <h2 className="subtitle">نسيت كلمة السر</h2>
            <p className="hint">اكتب الإيميل اللي سجّلت بيه، وهنبعتلك رابط تعمل منه كلمة سر جديدة.</p>
          </>
        ) : (
          <div className="tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'tab active' : 'tab'}
              onClick={() => switchMode('login')}
            >
              تسجيل الدخول
            </button>
            <button
              role="tab"
              aria-selected={mode === 'signup'}
              className={mode === 'signup' ? 'tab active' : 'tab'}
              onClick={() => switchMode('signup')}
            >
              إنشاء حساب
            </button>
          </div>
        )}

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
          {mode !== 'forgot' && (
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
          )}
          {error && <p className="error">{error}</p>}
          {info && <p className="info">{info}</p>}
          <button className="btn" type="submit" disabled={busy}>
            {busy
              ? 'لحظة…'
              : mode === 'login'
                ? 'دخول'
                : mode === 'signup'
                  ? 'إنشاء الحساب'
                  : 'ابعت رابط تغيير كلمة السر'}
          </button>
        </form>

        {canResend && (
          <button className="btn ghost full" onClick={() => void resend()} disabled={busy}>
            ابعت رسالة التأكيد تاني
          </button>
        )}
        {mode === 'login' && (
          <button className="link-btn" onClick={() => switchMode('forgot')}>
            نسيت كلمة السر؟
          </button>
        )}
        {mode === 'forgot' && (
          <button className="link-btn" onClick={() => switchMode('login')}>
            → الرجوع لتسجيل الدخول
          </button>
        )}
      </div>
    </div>
  );
}
