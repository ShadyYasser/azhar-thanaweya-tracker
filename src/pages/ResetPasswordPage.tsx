import { useAuth } from '../auth/AuthProvider';
import { PasswordForm } from '../components/PasswordForm';

// Shown after opening a password-reset link (the link has already signed the user in).
export function ResetPasswordPage() {
  const { finishRecovery, signOut } = useAuth();

  return (
    <div className="center">
      <div className="card narrow">
        <h1 className="title">تعيين كلمة سر جديدة</h1>
        <p className="muted">اكتب كلمة السر الجديدة لحسابك.</p>
        <PasswordForm submitLabel="حفظ كلمة السر" onDone={finishRecovery} />
        <button className="btn ghost full" onClick={() => void signOut()}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
