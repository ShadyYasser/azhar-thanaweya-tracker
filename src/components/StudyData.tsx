import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth/AuthProvider';
import { loadCurriculum, loadMigrations, visibilityOf, visibleSubjects } from '../lib/content';
import {
  applyChange,
  applyLessonMigrations,
  hasPendingMigrations,
  loadMyProgress,
  saveProgress,
  type ProgressMap,
} from '../lib/progress';
import type { Curriculum, LessonStatus, Subject } from '../lib/types';

interface StudyData {
  curriculum: Curriculum | null;
  subjects: Subject[];
  progress: ProgressMap;
  loading: boolean;
  error: string | null;
  updateLesson: (lessonId: string, change: { status?: LessonStatus; memorized?: boolean }) => Promise<void>;
}

const StudyDataContext = createContext<StudyData | null>(null);

// Loads the active grade's curriculum and the user's progress once, shared by all pages.
export function StudyDataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [progress, setProgress] = useState<ProgressMap>(new Map());
  const progressRef = useRef<ProgressMap>(progress);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userId = profile?.id;
  const grade = profile?.active_grade;

  useEffect(() => {
    if (!userId || !grade) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadCurriculum(grade), loadMyProgress(userId), loadMigrations(grade)])
      .then(async ([c, loaded, migrations]) => {
        let p = loaded;
        // Carry progress from split/merged lessons to their new IDs. Failing here must
        // not block the page: the old rows stay intact and it is retried next load.
        if (hasPendingMigrations(migrations, p)) {
          try {
            if ((await applyLessonMigrations(migrations)) > 0) p = await loadMyProgress(userId);
          } catch (err) {
            console.warn('apply_lesson_migrations failed', err);
          }
        }
        if (cancelled) return;
        setCurriculum(c);
        progressRef.current = p;
        setProgress(p);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId, grade]);

  const subjects = useMemo(
    () =>
      curriculum
        ? visibleSubjects(
            curriculum,
            visibilityOf({
              madhhab: profile?.madhhab ?? null,
              show_french: profile?.show_french ?? false,
              show_qiraat: profile?.show_qiraat ?? false,
            }),
          )
        : [],
    [curriculum, profile?.madhhab, profile?.show_french, profile?.show_qiraat],
  );

  const updateLesson = useCallback<StudyData['updateLesson']>(
    async (lessonId, change) => {
      if (!userId) return;
      const prev = progressRef.current.get(lessonId);
      const { row, logAction } = applyChange(userId, lessonId, prev, change);
      // Optimistic update; roll back if the save fails.
      progressRef.current = new Map(progressRef.current).set(lessonId, row);
      setProgress(progressRef.current);
      try {
        await saveProgress(row, logAction);
      } catch (err) {
        const next = new Map(progressRef.current);
        if (prev) next.set(lessonId, prev);
        else next.delete(lessonId);
        progressRef.current = next;
        setProgress(next);
        throw err;
      }
    },
    [userId],
  );

  return (
    <StudyDataContext.Provider value={{ curriculum, subjects, progress, loading, error, updateLesson }}>
      {children}
    </StudyDataContext.Provider>
  );
}

export function useStudyData(): StudyData {
  const ctx = useContext(StudyDataContext);
  if (!ctx) throw new Error('useStudyData must be used inside StudyDataProvider');
  return ctx;
}
