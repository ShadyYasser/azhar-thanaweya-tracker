// Content types (mirror content/*.json).

export type GradeStatus = 'available' | 'planned';

export interface GradeEntry {
  code: string;
  grade: number;
  name: string;
  track: string | null;
  status: GradeStatus;
  curriculum?: string;
}

export interface ContentIndex {
  schemaVersion: number;
  academicYear: string;
  grades: GradeEntry[];
}

export type LessonKind = 'quran' | 'exercise' | 'review' | 'text';

export interface Lesson {
  id: string;
  title: string;
  month: string;
  term: number;
  monthName: string;
  note?: string;
  memorize?: string;
  kind?: LessonKind;
  surah?: string;
  fromAyah?: number;
  toAyah?: number;
  archived?: boolean;
}

export interface Unit {
  title: string;
  lessons: Lesson[];
}

export interface Subject {
  id: string;
  name: string;
  group: string;
  book?: string;
  periods?: string;
  units: Unit[];
  madhhab?: Madhhab;
  // Optional subjects are shown only when the profile flag for their optionalKey is on.
  optional?: boolean;
  optionalKey?: OptionalKey;
  note?: string;
  needsVerification?: string;
}

// content/grades/<grade>/migrations.json: old lesson ID -> new lesson IDs.
export type LessonMigrations = Record<string, string[]>;

export interface Curriculum {
  schemaVersion: number;
  contentVersion: string;
  gradeCode: string;
  academicYear: string;
  grade: string;
  track: string;
  months: { id: string; name: string; term: number }[];
  groups: { id: string; name: string }[];
  madhhabs: { id: Madhhab; name: string }[];
  subjects: Subject[];
}

// Database types (mirror supabase/migrations).

export type Role = 'student' | 'admin';
export type Madhhab = 'hanafi' | 'shafei' | 'maliki' | 'hanbali';
export type OptionalKey = 'french' | 'qiraat';
export type LessonStatus = 'not_started' | 'studied' | 'revised' | 'mastered';

export interface Profile {
  id: string;
  display_name: string | null;
  email: string | null;
  role: Role;
  madhhab: Madhhab | null;
  show_french: boolean;
  show_qiraat: boolean;
  active_grade: string | null;
  created_at: string;
}

export interface LessonProgress {
  user_id: string;
  lesson_id: string;
  status: LessonStatus;
  memorized: boolean;
  revision_count: number;
  studied_at: string | null;
  last_revised_at: string | null;
  confidence: number | null;
  notes: string | null;
  updated_at: string;
}

// Quiz files: content/grades/<grade>/quizzes/<lessonId>.json (plan section 5).

export type QuizQuestion =
  | { id: string; type: 'mcq'; text: string; choices: string[]; answer: number; explanation?: string }
  | { id: string; type: 'true_false'; text: string; answer: boolean; explanation?: string }
  | { id: string; type: 'fill'; text: string; answer: string[]; explanation?: string }
  | { id: string; type: 'essay'; text: string; modelAnswer: string };

export interface Quiz {
  quizId: string;
  lessonId: string;
  version: number;
  title: string;
  questions: QuizQuestion[];
}

export interface QuizAttempt {
  id: number;
  lesson_id: string;
  quiz_id: string;
  quiz_version: number;
  score: number;
  max_score: number;
  created_at: string;
}
