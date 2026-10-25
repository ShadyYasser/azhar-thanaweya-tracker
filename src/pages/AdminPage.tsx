import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { gradeLabel, loadCurriculum, madhhabName, visibilityOf, visibleSubjects } from '../lib/content';
import { fetchAll, supabase } from '../lib/supabase';
import { computeStats, type ProgressMap } from '../lib/progress';
import type { LessonProgress, Profile, Role } from '../lib/types';

interface UserRow extends Profile {
  // Completion in the user's active grade; null until setup is done.
  percent: number | null;
}

function countBy<T>(items: T[], key: (x: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

async function loadUsers(): Promise<UserRow[]> {
  const profiles = await fetchAll<Profile>((from, to) =>
    supabase.from('profiles').select('*').order('created_at').range(from, to),
  );
  const rows = await fetchAll<Pick<LessonProgress, 'user_id' | 'lesson_id' | 'status'>>((from, to) =>
    supabase
      .from('lesson_progress')
      .select('user_id, lesson_id, status')
      .neq('status', 'not_started')
      .order('user_id')
      .order('lesson_id')
      .range(from, to),
  );

  const byUser = new Map<string, ProgressMap>();
  for (const r of rows) {
    let m = byUser.get(r.user_id);
    if (!m) byUser.set(r.user_id, (m = new Map()));
    m.set(r.lesson_id, r as LessonProgress);
  }

  // Each student's completion is measured against their own active grade and choices.
  const users: UserRow[] = [];
  for (const p of profiles) {
    let percent: number | null = null;
    if (p.active_grade && p.madhhab) {
      try {
        const c = await loadCurriculum(p.active_grade);
        const subjects = visibleSubjects(c, visibilityOf(p));
        percent = computeStats(subjects, byUser.get(p.id) ?? new Map()).percent;
      } catch {
        // Grade without a curriculum file: leave it out of the average.
      }
    }
    users.push({ ...p, percent });
  }
  return users;
}

export function AdminPage() {
  const { profile: me } = useAuth();
  const [users, setUsers] = useState<UserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);

  const reload = useCallback(() => {
    loadUsers()
      .then(setUsers)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(reload, [reload]);

  const stats = useMemo(() => {
    if (!users) return null;
    const setUp = users.filter((u) => u.active_grade && u.madhhab);
    const percents = users.map((u) => u.percent).filter((p): p is number => p !== null);
    return {
      totalUsers: users.length,
      admins: users.filter((u) => u.role === 'admin').length,
      notSetUp: users.length - setUp.length,
      byGrade: countBy(setUp, (u) => gradeLabel(u.active_grade)),
      byMadhhab: countBy(setUp, (u) => madhhabName(u.madhhab)),
      french: setUp.filter((u) => u.show_french).length,
      qiraat: setUp.filter((u) => u.show_qiraat).length,
      avgPercent: percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : null,
      avgCount: percents.length,
    };
  }, [users]);

  const changeRole = async (user: UserRow, role: Role) => {
    const who = user.display_name || user.email || 'المستخدم ده';
    const question =
      role === 'admin'
        ? `تخلّي ${who} admin؟ هيقدر يشوف بيانات كل المستخدمين ويغيّر أدوارهم.`
        : `تشيل صلاحية الـ admin من ${who}؟`;
    if (!window.confirm(question)) return;
    setBusyId(user.id);
    setRoleError(null);
    const { error: err } = await supabase.from('profiles').update({ role }).eq('id', user.id);
    setBusyId(null);
    if (err) {
      setRoleError(
        err.message.includes('last admin') ? 'مينفعش تشيل آخر admin في الموقع.' : `ما اتغيّرش الدور: ${err.message}`,
      );
      return;
    }
    setUsers((list) => list?.map((u) => (u.id === user.id ? { ...u, role } : u)) ?? null);
  };

  // Deletes the account and all its progress (admin_delete_user cascades); irreversible.
  const deleteUser = async (user: UserRow) => {
    const who = user.email || user.display_name || 'المستخدم ده';
    const ok = window.confirm(
      `هتمسح حساب ${who} نهائياً مع كل تقدمه ومحاولات الكويز بتاعته.\nمش هينفع ترجّعه بعد كده. متأكد؟`,
    );
    if (!ok) return;
    setBusyId(user.id);
    setRoleError(null);
    const { error: err } = await supabase.rpc('admin_delete_user', { target: user.id });
    setBusyId(null);
    if (err) {
      setRoleError(
        err.message.includes('demote the admin')
          ? 'شيل صلاحية الـ admin من الحساب الأول، وبعدين امسحه.'
          : `ما اتمسحش الحساب: ${err.message}`,
      );
      return;
    }
    setUsers((list) => list?.filter((u) => u.id !== user.id) ?? null);
  };

  if (error) return <p className="error">تعذّر تحميل البيانات: {error}</p>;
  if (!users || !stats) return <p className="muted">جارٍ التحميل…</p>;

  const q = query.trim().toLowerCase();
  const shown = q
    ? users.filter((u) => (u.email ?? '').toLowerCase().includes(q) || (u.display_name ?? '').toLowerCase().includes(q))
    : users;

  return (
    <div className="stack">
      <h1 className="title">لوحة المتحكم</h1>

      <div className="grid">
        <div className="card stat">
          <span className="muted small">عدد المستخدمين</span>
          <span className="big-percent">{stats.totalUsers}</span>
          <span className="muted small">
            منهم {stats.admins} admin · {stats.notSetUp} لسه ما كمّلوش الإعداد
          </span>
        </div>
        <div className="card stat">
          <span className="muted small">متوسط الإنجاز</span>
          <span className="big-percent">{stats.avgPercent === null ? '—' : `${stats.avgPercent}%`}</span>
          <span className="muted small">على {stats.avgCount} طالب في صفوفهم الحالية</span>
        </div>
        <div className="card stat">
          <span className="muted small">بيدرسوا الفرنسية</span>
          <span className="big-percent">{stats.french}</span>
        </div>
        <div className="card stat">
          <span className="muted small">بيدرسوا القراءات</span>
          <span className="big-percent">{stats.qiraat}</span>
        </div>
      </div>

      <section className="card">
        <h2>التوزيع على الصفوف</h2>
        <Table rows={stats.byGrade} empty="مفيش طلاب لسه." />
      </section>

      <section className="card">
        <h2>التوزيع على المذاهب</h2>
        <Table rows={stats.byMadhhab} empty="مفيش طلاب لسه." />
      </section>

      <section className="card">
        <h2>إدارة المستخدمين</h2>
        <input
          type="search"
          className="search"
          placeholder="دوّر بالإيميل أو الاسم"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {roleError && <p className="error">{roleError}</p>}
        <ul className="users">
          {shown.map((u) => (
            <li key={u.id} className="user-row">
              <div className="user-info">
                <span className="user-name">{u.display_name || '—'}</span>
                <span className="muted small" dir="ltr">
                  {u.email ?? '—'}
                </span>
                <span className="muted small">
                  {u.active_grade ? `${gradeLabel(u.active_grade)} · ${madhhabName(u.madhhab)}` : 'لسه ما كمّلش الإعداد'}
                  {u.show_french && ' · فرنسي'}
                  {u.show_qiraat && ' · قراءات'}
                  {u.percent !== null && ` · ${u.percent}%`}
                </span>
              </div>
              <div className="user-actions">
                <label className="role-select">
                  <span className="sr-only">الدور</span>
                  <select
                    value={u.role}
                    disabled={busyId === u.id || u.id === me?.id}
                    title={u.id === me?.id ? 'مينفعش تغيّر دورك بنفسك' : undefined}
                    onChange={(e) => void changeRole(u, e.target.value as Role)}
                  >
                    <option value="student">طالب</option>
                    <option value="admin">متحكم (admin)</option>
                  </select>
                </label>
                {u.id !== me?.id && (
                  <button
                    className="danger-btn"
                    disabled={busyId === u.id || u.role === 'admin'}
                    title={u.role === 'admin' ? 'شيل صلاحية الـ admin الأول' : undefined}
                    onClick={() => void deleteUser(u)}
                  >
                    مسح الحساب
                  </button>
                )}
              </div>
            </li>
          ))}
          {shown.length === 0 && <li className="muted">مفيش نتايج.</li>}
        </ul>
      </section>
    </div>
  );
}

function Table({ rows, empty }: { rows: [string, number][]; empty: string }) {
  if (rows.length === 0) return <p className="muted">{empty}</p>;
  return (
    <table className="table">
      <tbody>
        {rows.map(([label, n]) => (
          <tr key={label}>
            <td>{label}</td>
            <td className="num">{n}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
