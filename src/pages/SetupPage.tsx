import { useAuth } from '../auth/AuthProvider';
import { ProfileForm } from '../components/ProfileForm';

export function SetupPage() {
  const { profile, signOut } = useAuth();
  if (!profile) return null;

  return (
    <div className="center">
      <div className="card narrow">
        <h1 className="title">أهلاً بيك</h1>
        <p className="muted">قبل ما نبدأ، اختار صفك ومذهبك عشان نعرضلك موادك بالظبط.</p>
        <ProfileForm profile={profile} submitLabel="ابدأ" />
        <button className="btn ghost full" onClick={() => void signOut()}>
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
