import { fetchAll, supabase } from './supabase';
import { activeLessons } from './content';
import type { LessonMigrations, LessonProgress, LessonStatus, Subject } from './types';

export const STATUS_OPTIONS: { id: LessonStatus; label: string }[] = [
  { id: 'not_started', label: 'لم يبدأ' },
  { id: 'studied', label: 'ذاكرته' },
  { id: 'revised', label: 'راجعته' },
  { id: 'mastered', label: 'أتقنته' },
];

export type ProgressMap = Map<string, LessonProgress>;

export async function loadMyProgress(userId: string): Promise<ProgressMap> {
  const rows = await fetchAll<LessonProgress>((from, to) =>
    supabase.from('lesson_progress').select('*').eq('user_id', userId).order('lesson_id').range(from, to),
  );
  return new Map(rows.map((r) => [r.lesson_id, r]));
}

// A lesson counts as done once it has been studied at least once.
export function isDone(status: LessonStatus | undefined): boolean {
  return status !== undefined && status !== 'not_started';
}

export interface Stats {
  total: number;
  done: number;
  mastered: number;
  percent: number;
}

export function computeStats(subjects: Subject[], progress: ProgressMap): Stats {
  let total = 0;
  let done = 0;
  let mastered = 0;
  for (const s of subjects) {
    for (const l of activeLessons(s)) {
      total++;
      const st = progress.get(l.id)?.status;
      if (isDone(st)) done++;
      if (st === 'mastered') mastered++;
    }
  }
  return { total, done, mastered, percent: total ? Math.round((done / total) * 100) : 0 };
}

function emptyRow(userId: string, lessonId: string): LessonProgress {
  return {
    user_id: userId,
    lesson_id: lessonId,
    status: 'not_started',
    memorized: false,
    revision_count: 0,
    studied_at: null,
    last_revised_at: null,
    confidence: null,
    notes: null,
    updated_at: new Date().toISOString(),
  };
}

// Returns the next row for a status/memorized change plus the study_log action to record.
export function applyChange(
  userId: string,
  lessonId: string,
  prev: LessonProgress | undefined,
  change: { status?: LessonStatus; memorized?: boolean },
): { row: LessonProgress; logAction: 'study' | 'revise' | 'recite' | null } {
  const now = new Date().toISOString();
  const row = { ...(prev ?? emptyRow(userId, lessonId)) };
  let logAction: 'study' | 'revise' | 'recite' | null = null;

  if (change.status && change.status !== row.status) {
    row.status = change.status;
    if (change.status === 'studied') {
      row.studied_at ??= now;
      logAction = 'study';
    } else if (change.status === 'revised' || change.status === 'mastered') {
      row.studied_at ??= now;
      row.last_revised_at = now;
      row.revision_count += 1;
      logAction = 'revise';
    }
  }
  if (change.memorized !== undefined && change.memorized !== row.memorized) {
    row.memorized = change.memorized;
    if (change.memorized) logAction = 'recite';
  }
  row.updated_at = now;
  return { row, logAction };
}

export async function saveProgress(
  row: LessonProgress,
  logAction: 'study' | 'revise' | 'recite' | null,
): Promise<void> {
  const { user_id, lesson_id, status, memorized, revision_count, studied_at, last_revised_at } = row;
  const { error } = await supabase
    .from('lesson_progress')
    .upsert({ user_id, lesson_id, status, memorized, revision_count, studied_at, last_revised_at });
  if (error) throw new Error(error.message);
  if (logAction) {
    // The log feeds later statistics; a failed log entry must not undo the saved status.
    await supabase.from('study_log').insert({ user_id, lesson_id, action: logAction });
  }
}

// Copies progress from split/merged lessons to their new IDs via the
// apply_lesson_migrations RPC (RLS-scoped; copies, never overwrites or deletes).
// The RPC remembers which (old -> new) pairs each user went through, so a still-active
// old lesson studied after the split doesn't spill onto the lessons split off from it.
// It must run even without progress (to record the pairs), but only once per user,
// grade and content version here; repeating it (new device, cleared storage) is harmless.
export async function runLessonMigrations(
  userId: string,
  gradeCode: string,
  contentVersion: string,
  migrations: LessonMigrations,
): Promise<number> {
  const key = `lesson-migrations:${userId}:${gradeCode}`;
  try {
    if (localStorage.getItem(key) === contentVersion) return 0;
  } catch {
    // Storage unavailable: just run it.
  }
  let copied = 0;
  if (Object.keys(migrations).length > 0) {
    const { data, error } = await supabase.rpc('apply_lesson_migrations', { mappings: migrations });
    if (error) throw new Error(error.message);
    copied = (data as number | null) ?? 0;
  }
  try {
    localStorage.setItem(key, contentVersion);
  } catch {
    // Not remembered; the next load runs it again, which changes nothing.
  }
  return copied;
}
