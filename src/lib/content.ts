import indexJson from '../../content/index.json';
import type { ContentIndex, Curriculum, Lesson, Madhhab, Subject } from './types';

export const contentIndex = indexJson as ContentIndex;

export const availableGrades = contentIndex.grades.filter((g) => g.status === 'available');

export const MADHHABS: { id: Madhhab; name: string }[] = [
  { id: 'hanafi', name: 'الحنفي' },
  { id: 'shafei', name: 'الشافعي' },
  { id: 'maliki', name: 'المالكي' },
  { id: 'hanbali', name: 'الحنبلي' },
];

export function madhhabName(id: string | null | undefined): string {
  return MADHHABS.find((m) => m.id === id)?.name ?? 'غير محدد';
}

export function gradeLabel(code: string | null | undefined): string {
  const g = contentIndex.grades.find((x) => x.code === code);
  if (!g) return code ?? 'غير محدد';
  return g.track ? `${g.name} – ${g.track}` : g.name;
}

// Curricula are bundled per grade and loaded on demand.
const curriculumModules = import.meta.glob<{ default: Curriculum }>(
  '../../content/grades/*/curriculum.json',
);

// Quiz files (content/grades/<grade>/quizzes/<lessonId>.json); a lesson has a quiz
// only when its file exists.
const quizModules = import.meta.glob('../../content/grades/*/quizzes/*.json');

const curriculumCache = new Map<string, Promise<Curriculum>>();

export function loadCurriculum(gradeCode: string): Promise<Curriculum> {
  let p = curriculumCache.get(gradeCode);
  if (!p) {
    const loader = curriculumModules[`../../content/grades/${gradeCode}/curriculum.json`];
    p = loader
      ? loader().then((m) => m.default)
      : Promise.reject(new Error(`لا يوجد منهج للصف ${gradeCode}`));
    curriculumCache.set(gradeCode, p);
  }
  return p;
}

export function hasQuiz(gradeCode: string, lessonId: string): boolean {
  return `../../content/grades/${gradeCode}/quizzes/${lessonId}.json` in quizModules;
}

export interface Visibility {
  madhhab: Madhhab | null;
  showFrench: boolean;
}

// Fiqh shows only for the student's madhhab; optional subjects (French) only when enabled.
export function isSubjectVisible(subject: Subject, v: Visibility): boolean {
  if (subject.madhhab && subject.madhhab !== v.madhhab) return false;
  if (subject.optional && !v.showFrench) return false;
  return true;
}

export function visibleSubjects(curriculum: Curriculum, v: Visibility): Subject[] {
  return curriculum.subjects.filter((s) => isSubjectVisible(s, v));
}

export function activeLessons(subject: Subject): Lesson[] {
  return subject.units.flatMap((u) => u.lessons).filter((l) => !l.archived);
}

export function needsMemorization(lesson: Lesson): boolean {
  return Boolean(lesson.memorize) || lesson.kind === 'quran';
}
