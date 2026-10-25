import { useState, type FormEvent } from 'react';
import { authErrorMessage } from '../lib/authErrors';
import { supabase } from '../lib/supabase';

// Sets a new password for the signed-in user (after a reset link, or from settings).
export function PasswordForm({ submitLabel, onDone }: { submitLabel: string; onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('كلمتين السر مش زي بعض.');
      return;
    }
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(authErrorMessage(err));
      return;
    }
    setPassword('');
    setConfirm('');
    onDone();
  };

  return (
    <form onSubmit={submit} className="form">
      <label>
        كلمة السر الجديدة
        <input
          type="password"
          dir="ltr"
          required
          minLength={6}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <label>
        اكتبها تاني للتأكيد
        <input
          type="password"
          dir="ltr"
          required
          minLength={6}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'جارٍ الحفظ…' : submitLabel}
      </button>
    </form>
  );
}
