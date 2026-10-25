import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProgressBar } from '../components/ProgressBar';
import { useStudyData } from '../components/StudyData';
import { needsMemorization } from '../lib/content';
import { computeStats, STATUS_OPTIONS } from '../lib/progress';
import type { Lesson, LessonStatus } from '../lib/types';

type TermFilter = 'all' | 1 | 2;

export function SubjectPage() {
  const { subjectId } = useParams();
  const { subjects, progress, loading, error, updateLesson } = useStudyData();
  const [term, setTerm] = useState<TermFilter>('all');
  const [saveError, setSaveError] = useState<string | null>(null);

  if (error) return <p className="error">تعذّر تحميل البيانات: {error}</p>;
  if (loading) return <p className="muted">جارٍ التحميل…</p>;

  const subject = subjects.find((s) => s.id === subjectId);
  if (!subject) {
    return (
      <div className="stack">
        <p>المادة دي مش ظاهرة في اختياراتك الحالية.</p>
        <Link to="/" className="btn">
          الرجوع للرئيسية
        </Link>
      </div>
    );
  }

  const stats = computeStats([subject], progress);
  const units = subject.units
    .map((u) => ({
      ...u,
      lessons: u.lessons.filter((l) => !l.archived && (term === 'all' || l.term === term)),
    }))
    .filter((u) => u.lessons.length > 0);

  const change = (lessonId: string, c: { status?: LessonStatus; memorized?: boolean }) => {
    setSaveError(null);
    updateLesson(lessonId, c).catch((err: unknown) =>
      setSaveError(`ما اتحفظش التغيير: ${err instanceof Error ? err.message : String(err)}`),
    );
  };

  return (
    <div className="stack">
      <Link to="/" className="back">
        → الرئيسية
      </Link>

      <section className="card">
        <div className="subject-head">
          <h1 className="title">{subject.name}</h1>
          <span className="big-percent">{stats.percent}%</span>
        </div>
        <ProgressBar percent={stats.percent} label={subject.name} />
        <p className="muted small">
          ذاكرت {stats.done} من {stats.total} درس · أتقنت {stats.mastered}
        </p>
        {subject.book && <p className="small">📘 {subject.book}</p>}
        {subject.periods && <p className="small muted">{subject.periods}</p>}
        {subject.note && <p className="note">{subject.note}</p>}
        {subject.needsVerification && <p className="warn">⚠️ {subject.needsVerification}</p>}
      </section>

      <div className="tabs" role="tablist" aria-label="الفصل الدراسي">
        {(
          [
            ['all', 'الكل'],
            [1, 'الفصل الأول'],
            [2, 'الفصل الثاني'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={term === id}
            className={term === id ? 'tab active' : 'tab'}
            onClick={() => setTerm(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {saveError && <p className="error">{saveError}</p>}

      {units.length === 0 && <p className="muted">مفيش دروس في الفصل ده.</p>}

      {units.map((u, i) => (
        <section key={`${u.title}-${i}`} className="unit">
          <h2>{u.title}</h2>
          <ol className="lessons">
            {u.lessons.map((l) => (
              <LessonRow
                key={l.id}
                lesson={l}
                status={progress.get(l.id)?.status ?? 'not_started'}
                memorized={progress.get(l.id)?.memorized ?? false}
                onChange={(c) => change(l.id, c)}
              />
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function LessonRow({
  lesson,
  status,
  memorized,
  onChange,
}: {
  lesson: Lesson;
  status: LessonStatus;
  memorized: boolean;
  onChange: (c: { status?: LessonStatus; memorized?: boolean }) => void;
}) {
  return (
    <li className={`lesson status-${status}`}>
      <div className="lesson-main">
        <span className="lesson-title">{lesson.title}</span>
        <span className="badge">{lesson.monthName}</span>
      </div>
      {lesson.note && <p className="note small">{lesson.note}</p>}
      {lesson.memorize && <p className="memorize small">📌 المطلوب حفظه: {lesson.memorize}</p>}
      <div className="lesson-actions">
        <div className="segmented" role="radiogroup" aria-label={`حالة: ${lesson.title}`}>
          {STATUS_OPTIONS.map((o) => (
            <button
              key={o.id}
              role="radio"
              aria-checked={status === o.id}
              className={status === o.id ? `seg active seg-${o.id}` : 'seg'}
              onClick={() => onChange({ status: o.id })}
            >
              {o.label}
            </button>
          ))}
        </div>
        {needsMemorization(lesson) && (
          <label className={memorized ? 'check memorized on' : 'check memorized'}>
            <input type="checkbox" checked={memorized} onChange={(e) => onChange({ memorized: e.target.checked })} />
            حفظت
          </label>
        )}
      </div>
    </li>
  );
}
