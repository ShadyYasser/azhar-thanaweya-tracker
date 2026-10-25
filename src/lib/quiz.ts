import { supabase } from './supabase';
import type { Quiz, QuizAttempt, QuizQuestion } from './types';

export type Answer = number | boolean | string | null;
export type Answers = Record<string, Answer>;

// Lenient comparison for "fill" answers: ignore tashkeel, tatweel, alef/ya/ta-marbuta
// variants, punctuation and extra spaces.
export function normalizeArabic(s: string): string {
  return s
    .normalize('NFKC')
    .replace(/[ً-ْٰـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[.,،؛;:!?؟"'«»()-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// null = not auto-graded (essay: the student compares with the model answer).
export function isCorrect(q: QuizQuestion, a: Answer): boolean | null {
  switch (q.type) {
    case 'mcq':
      return a === q.answer;
    case 'true_false':
      return a === q.answer;
    case 'fill':
      return typeof a === 'string' && a.trim() !== '' && q.answer.some((x) => normalizeArabic(x) === normalizeArabic(a));
    case 'essay':
      return null;
  }
}

export function grade(quiz: Quiz, answers: Answers): { score: number; maxScore: number } {
  let score = 0;
  let maxScore = 0;
  for (const q of quiz.questions) {
    const ok = isCorrect(q, answers[q.id] ?? null);
    if (ok === null) continue;
    maxScore++;
    if (ok) score++;
  }
  return { score, maxScore };
}

export async function saveAttempt(quiz: Quiz, answers: Answers, score: number, maxScore: number): Promise<void> {
  const { error } = await supabase.from('quiz_attempts').insert({
    lesson_id: quiz.lessonId,
    quiz_id: quiz.quizId,
    quiz_version: quiz.version,
    score,
    max_score: maxScore,
    answers,
  });
  if (error) throw new Error(error.message);
}

export async function loadAttempts(userId: string, lessonId: string): Promise<QuizAttempt[]> {
  // Filter by user explicitly: RLS lets admins read everyone's attempts.
  const { data, error } = await supabase
    .from('quiz_attempts')
    .select('id, lesson_id, quiz_id, quiz_version, score, max_score, created_at')
    .eq('user_id', userId)
    .eq('lesson_id', lessonId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message);
  return (data ?? []) as QuizAttempt[];
}
