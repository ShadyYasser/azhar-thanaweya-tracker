import indexJson from '../../content/index.json';
import type {
  ContentIndex,
  Curriculum,
  Lesson,
  LessonMigrations,
  Madhhab,
  OptionalKey,
  Profile,
  Quiz,
  Subject,
} from './types';

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
const quizModules = import.meta.glob<{ default: Quiz }>('../../content/grades/*/quizzes/*.json');

const migrationModules = import.meta.glob<{ default: LessonMigrations }>(
  '../../content/grades/*/migrations.json',
);

const curriculumCache = new Map<string, Promise<Curriculum>>();

export async function loadMigrations(gradeCode: string): Promise<LessonMigrations> {
  const loader = migrationModules[`../../content/grades/${gradeCode}/migrations.json`];
  return loader ? (await loader()).default : {};
}

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

export async function loadQuiz(gradeCode: string, lessonId: string): Promise<Quiz | null> {
  const loader = quizModules[`../../content/grades/${gradeCode}/quizzes/${lessonId}.json`];
  return loader ? (await loader()).default : null;
}

export function findLesson(curriculum: Curriculum, lessonId: string): { subject: Subject; lesson: Lesson } | null {
  for (const subject of curriculum.subjects) {
    for (const u of subject.units) {
      const lesson = u.lessons.find((l) => l.id === lessonId);
      if (lesson) return { subject, lesson };
    }
  }
  return null;
}

export interface Visibility {
  madhhab: Madhhab | null;
  optional: Record<OptionalKey, boolean>;
}

// Labels for the profile options that switch optional subjects on.
export const OPTIONAL_SUBJECTS: { key: OptionalKey; label: string }[] = [
  { key: 'french', label: 'المعهد بيدرّس اللغة الفرنسية (لغة ثانية)' },
  { key: 'qiraat', label: 'بدرس القراءات (للطلاب المكفوفين)' },
];

export function visibilityOf(p: Pick<Profile, 'madhhab' | 'show_french' | 'show_qiraat'>): Visibility {
  return { madhhab: p.madhhab, optional: { french: p.show_french, qiraat: p.show_qiraat ?? false } };
}

// Fiqh shows only for the student's madhhab; an optional subject only when the
// profile flag for its optionalKey is on (subjects without a key count as French).
export function isSubjectVisible(subject: Subject, v: Visibility): boolean {
  if (subject.madhhab && subject.madhhab !== v.madhhab) return false;
  if (subject.optional && !v.optional[subject.optionalKey ?? 'french']) return false;
  return true;
}

// Optional-subject keys a curriculum actually uses (decides which options to offer).
export function optionalKeysOf(curriculum: Curriculum): Set<OptionalKey> {
  return new Set(curriculum.subjects.filter((s) => s.optional).map((s) => s.optionalKey ?? 'french'));
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
