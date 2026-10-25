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
import { loadCurriculum, visibleSubjects } from '../lib/content';
import { applyChange, loadMyProgress, saveProgress, type ProgressMap } from '../lib/progress';
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
    Promise.all([loadCurriculum(grade), loadMyProgress(userId)])
      .then(([c, p]) => {
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
        ? visibleSubjects(curriculum, { madhhab: profile?.madhhab ?? null, showFrench: profile?.show_french ?? false })
        : [],
    [curriculum, profile?.madhhab, profile?.show_french],
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
