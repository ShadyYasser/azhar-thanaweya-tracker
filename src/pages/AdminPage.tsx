import { useEffect, useState } from 'react';
import { gradeLabel, loadCurriculum, madhhabName, visibleSubjects } from '../lib/content';
import { fetchAll, supabase } from '../lib/supabase';
import { computeStats, type ProgressMap } from '../lib/progress';
import type { LessonProgress, Profile } from '../lib/types';

interface AdminStats {
  totalUsers: number;
  admins: number;
  notSetUp: number;
  byGrade: [string, number][];
  byMadhhab: [string, number][];
  french: number;
  avgPercent: number | null;
  avgCount: number;
}

function countBy<T>(items: T[], key: (x: T) => string): [string, number][] {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

async function loadAdminStats(): Promise<AdminStats> {
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
  const setUp = profiles.filter((p) => p.active_grade && p.madhhab);
  const percents: number[] = [];
  for (const p of setUp) {
    try {
      const c = await loadCurriculum(p.active_grade!);
      const subjects = visibleSubjects(c, { madhhab: p.madhhab, showFrench: p.show_french });
      percents.push(computeStats(subjects, byUser.get(p.id) ?? new Map()).percent);
    } catch {
      // Grade without a curriculum file: skip it in the average.
    }
  }

  return {
    totalUsers: profiles.length,
    admins: profiles.filter((p) => p.role === 'admin').length,
    notSetUp: profiles.length - setUp.length,
    byGrade: countBy(setUp, (p) => gradeLabel(p.active_grade)),
    byMadhhab: countBy(setUp, (p) => madhhabName(p.madhhab)),
    french: setUp.filter((p) => p.show_french).length,
    avgPercent: percents.length ? Math.round(percents.reduce((a, b) => a + b, 0) / percents.length) : null,
    avgCount: percents.length,
  };
}

export function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAdminStats()
      .then(setStats)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  if (error) return <p className="error">تعذّر تحميل الإحصائيات: {error}</p>;
  if (!stats) return <p className="muted">جارٍ التحميل…</p>;

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
      </div>

      <section className="card">
        <h2>التوزيع على الصفوف</h2>
        <Table rows={stats.byGrade} empty="مفيش طلاب لسه." />
      </section>

      <section className="card">
        <h2>التوزيع على المذاهب</h2>
        <Table rows={stats.byMadhhab} empty="مفيش طلاب لسه." />
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
