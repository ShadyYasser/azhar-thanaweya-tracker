import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { PasswordForm } from '../components/PasswordForm';
import { ProfileForm } from '../components/ProfileForm';

export function SettingsPage() {
  const { profile, session, signOut } = useAuth();
  const [saved, setSaved] = useState(false);
  const [passwordChanged, setPasswordChanged] = useState(false);
  if (!profile) return null;

  return (
    <div className="stack">
      <h1 className="title">الإعدادات</h1>
      <section className="card">
        <p className="muted">
          الحساب: <span dir="ltr">{session?.user.email}</span>
        </p>
        <ProfileForm
          key={`${profile.active_grade}-${profile.madhhab}-${profile.show_french}-${profile.show_qiraat}`}
          profile={profile}
          submitLabel="حفظ التغييرات"
          showName
          onSaved={() => setSaved(true)}
        />
        {saved && <p className="info">تم الحفظ.</p>}
        <p className="hint">
          تغيير الصف أو المذهب أو المواد الاختيارية مش بيمسح أي تقدم؛ التقدم القديم بيتخبى بس، ويرجع لو رجعت لنفس
          الاختيار.
        </p>
      </section>
      <section className="card">
        <h2>تغيير كلمة السر</h2>
        <PasswordForm submitLabel="تغيير كلمة السر" onDone={() => setPasswordChanged(true)} />
        {passwordChanged && <p className="info">تم تغيير كلمة السر.</p>}
      </section>
      <button className="btn ghost" onClick={() => void signOut()}>
        تسجيل الخروج
      </button>
    </div>
  );
}
