import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  availableGrades,
  contentIndex,
  gradeLabel,
  loadCurriculum,
  MADHHABS,
  OPTIONAL_SUBJECTS,
  optionalKeysOf,
} from '../lib/content';
import { supabase } from '../lib/supabase';
import type { Madhhab, OptionalKey, Profile } from '../lib/types';

interface Props {
  profile: Profile;
  submitLabel: string;
  showName?: boolean;
  onSaved?: () => void;
}

// Shared by first-time setup and settings. Changing grade or madhhab never deletes
// progress: rows stay keyed by lesson ID and other subjects are just hidden.
export function ProfileForm({ profile, submitLabel, showName, onSaved }: Props) {
  const { refreshProfile } = useAuth();
  const [grade, setGrade] = useState(profile.active_grade ?? availableGrades[0]?.code ?? '');
  const [madhhab, setMadhhab] = useState<Madhhab | ''>(profile.madhhab ?? '');
  const [optional, setOptional] = useState<Record<OptionalKey, boolean>>({
    french: profile.show_french,
    qiraat: profile.show_qiraat ?? false,
  });
  // Optional subjects the selected grade actually has; only those options are offered.
  const [offered, setOffered] = useState<Set<OptionalKey>>(new Set());
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep a no-longer-available current grade selectable so it isn't silently replaced.
  const gradeOptions =
    profile.active_grade && !availableGrades.some((g) => g.code === profile.active_grade)
      ? [...availableGrades, ...contentIndex.grades.filter((g) => g.code === profile.active_grade)]
      : availableGrades;

  useEffect(() => {
    let cancelled = false;
    if (!grade) return;
    loadCurriculum(grade)
      .then((c) => !cancelled && setOffered(optionalKeysOf(c)))
      .catch(() => !cancelled && setOffered(new Set()));
    return () => {
      cancelled = true;
    };
  }, [grade]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!grade || !madhhab) {
      setError('اختار الصف والمذهب.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { error: enrollErr } = await supabase
        .from('enrollments')
        .upsert(
          { user_id: profile.id, grade_code: grade, academic_year: contentIndex.academicYear },
          { onConflict: 'user_id,grade_code', ignoreDuplicates: true },
        );
      if (enrollErr) throw new Error(enrollErr.message);

      // Flags for options the grade doesn't offer keep their saved value.
      const update: Partial<Profile> = {
        active_grade: grade,
        madhhab,
        show_french: optional.french,
        show_qiraat: optional.qiraat,
      };
      if (showName) update.display_name = displayName.trim() || null;
      const { error: profErr } = await supabase.from('profiles').update(update).eq('id', profile.id);
      if (profErr) throw new Error(profErr.message);

      await refreshProfile();
      onSaved?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="form">
      {showName && (
        <label>
          الاسم
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={100} />
        </label>
      )}

      <label>
        الصف والشعبة
        <select value={grade} onChange={(e) => setGrade(e.target.value)} required>
          {gradeOptions.map((g) => (
            <option key={g.code} value={g.code}>
              {gradeLabel(g.code)}
            </option>
          ))}
        </select>
      </label>
      {contentIndex.grades.some((g) => g.status === 'planned') && (
        <p className="hint">باقي الصفوف هتتضاف قريباً إن شاء الله.</p>
      )}

      <fieldset>
        <legend>المذهب الفقهي</legend>
        <div className="choices">
          {MADHHABS.map((m) => (
            <label key={m.id} className={madhhab === m.id ? 'choice selected' : 'choice'}>
              <input
                type="radio"
                name="madhhab"
                value={m.id}
                checked={madhhab === m.id}
                onChange={() => setMadhhab(m.id)}
              />
              {m.name}
            </label>
          ))}
        </div>
        <p className="hint">هيظهرلك فقه مذهبك بس، والميراث بيظهر للكل.</p>
      </fieldset>

      {OPTIONAL_SUBJECTS.filter((o) => offered.has(o.key)).map((o) => (
        <label key={o.key} className="check">
          <input
            type="checkbox"
            checked={optional[o.key]}
            onChange={(e) => setOptional((prev) => ({ ...prev, [o.key]: e.target.checked }))}
          />
          {o.label}
        </label>
      ))}

      {error && <p className="error">{error}</p>}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'جارٍ الحفظ…' : submitLabel}
      </button>
    </form>
  );
}
