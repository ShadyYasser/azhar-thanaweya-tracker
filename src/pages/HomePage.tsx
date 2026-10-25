import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { ProgressBar } from '../components/ProgressBar';
import { useStudyData } from '../components/StudyData';
import { gradeLabel, madhhabName } from '../lib/content';
import { computeStats } from '../lib/progress';

export function HomePage() {
  const { profile } = useAuth();
  const { curriculum, subjects, progress, loading, error } = useStudyData();

  if (error) return <p className="error">تعذّر تحميل البيانات: {error}</p>;
  if (loading || !curriculum) return <p className="muted">جارٍ التحميل…</p>;

  const overall = computeStats(subjects, progress);
  const groups = curriculum.groups
    .map((g) => ({ ...g, subjects: subjects.filter((s) => s.group === g.id) }))
    .filter((g) => g.subjects.length > 0);

  return (
    <div className="stack">
      <section className="card hero">
        <div className="hero-head">
          <div>
            <h1 className="title">{profile?.display_name ? `أهلاً ${profile.display_name}` : 'أهلاً بيك'}</h1>
            <p className="muted small">
              {gradeLabel(profile?.active_grade)} · المذهب {madhhabName(profile?.madhhab)} · {curriculum.academicYear}
            </p>
          </div>
          <div className="big-percent">{overall.percent}%</div>
        </div>
        <ProgressBar percent={overall.percent} label="نسبة الإنجاز الكلية" />
        <p className="muted small">
          ذاكرت {overall.done} من {overall.total} درس · أتقنت {overall.mastered}
        </p>
      </section>

      {groups.map((g) => {
        const gs = computeStats(g.subjects, progress);
        return (
          <section key={g.id} className="group">
            <div className="group-head">
              <h2>{g.name}</h2>
              <span className="muted small">{gs.percent}%</span>
            </div>
            <div className="grid">
              {g.subjects.map((s) => {
                const st = computeStats([s], progress);
                return (
                  <Link key={s.id} to={`/subject/${s.id}`} className="card subject-card">
                    <div className="subject-head">
                      <span className="subject-name">{s.name}</span>
                      <span className="percent">{st.percent}%</span>
                    </div>
                    <ProgressBar percent={st.percent} label={s.name} />
                    <span className="muted small">
                      {st.done} / {st.total} درس
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
