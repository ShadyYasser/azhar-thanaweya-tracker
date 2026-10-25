import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { SetupPage } from './pages/SetupPage';
import { HomePage } from './pages/HomePage';
import { SubjectPage } from './pages/SubjectPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/AdminPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { QuizPage } from './pages/QuizPage';

export function App() {
  const { session, profile, loading, error, recovery, signOut } = useAuth();

  if (loading) return <div className="center muted">جارٍ التحميل…</div>;

  if (!session) {
    return (
      <Routes>
        <Route path="*" element={<AuthPage />} />
      </Routes>
    );
  }

  if (recovery) return <ResetPasswordPage />;

  if (!profile) {
    return (
      <div className="center">
        <div className="card narrow">
          <p>تعذّر تحميل بيانات الحساب.</p>
          {error && <p className="error">{error}</p>}
          <button className="btn" onClick={() => window.location.reload()}>
            إعادة المحاولة
          </button>{' '}
          <button className="btn ghost" onClick={() => void signOut()}>
            تسجيل الخروج
          </button>
        </div>
      </div>
    );
  }

  const needsSetup = !profile.active_grade || !profile.madhhab;
  if (needsSetup) {
    return (
      <Routes>
        <Route path="/setup" element={<SetupPage />} />
        <Route path="*" element={<Navigate to="/setup" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/subject/:subjectId" element={<SubjectPage />} />
        <Route path="/quiz/:lessonId" element={<QuizPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        {profile.role === 'admin' && <Route path="/admin" element={<AdminPage />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
