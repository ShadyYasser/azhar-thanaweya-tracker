import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useStudyData } from '../components/StudyData';
import { findLesson, loadQuiz } from '../lib/content';
import { grade, isCorrect, loadAttempts, saveAttempt, type Answer, type Answers } from '../lib/quiz';
import type { Quiz, QuizAttempt, QuizQuestion } from '../lib/types';

export function QuizPage() {
  const { lessonId = '' } = useParams();
  const { profile } = useAuth();
  const { curriculum, subjects } = useStudyData();
  const [quiz, setQuiz] = useState<Quiz | null | undefined>(undefined);
  const [answers, setAnswers] = useState<Answers>({});
  const [result, setResult] = useState<{ score: number; maxScore: number } | null>(null);
  const [attempts, setAttempts] = useState<QuizAttempt[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const gradeCode = curriculum?.gradeCode;
  const userId = profile?.id;

  useEffect(() => {
    if (!gradeCode || !userId) return;
    loadQuiz(gradeCode, lessonId)
      .then(setQuiz)
      .catch(() => setQuiz(null));
    loadAttempts(userId, lessonId)
      .then(setAttempts)
      .catch(() => setAttempts([]));
  }, [gradeCode, userId, lessonId]);

  if (!curriculum || quiz === undefined) return <p className="muted">جارٍ التحميل…</p>;

  const found = findLesson(curriculum, lessonId);
  const subjectVisible = found && subjects.some((s) => s.id === found.subject.id);
  if (!quiz || !found || !subjectVisible) {
    return (
      <div className="stack">
        <p>مفيش كويز للدرس ده.</p>
        <Link to="/" className="btn">
          الرجوع للرئيسية
        </Link>
      </div>
    );
  }

  const setAnswer = (id: string, a: Answer) => setAnswers((prev) => ({ ...prev, [id]: a }));

  const submit = async () => {
    const r = grade(quiz, answers);
    setResult(r);
    setError(null);
    setSaving(true);
    try {
      await saveAttempt(quiz, answers, r.score, r.maxScore);
      if (userId) setAttempts(await loadAttempts(userId, lessonId));
    } catch (err) {
      setError(`النتيجة ما اتحفظتش: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const retry = () => {
    setAnswers({});
    setResult(null);
    setError(null);
    window.scrollTo({ top: 0 });
  };

  return (
    <div className="stack">
      <Link to={`/subject/${found.subject.id}`} className="back">
        → {found.subject.name}
      </Link>

      <section className="card">
        <h1 className="title">{quiz.title}</h1>
        <p className="muted small">
          {found.lesson.title} · {quiz.questions.length} سؤال
        </p>
        {result && (
          <div className="quiz-result">
            <span className="big-percent">
              {result.score} من {result.maxScore}
            </span>
            {quiz.questions.some((q) => q.type === 'essay') && (
              <p className="hint">الأسئلة المقالية مش داخلة في الدرجة؛ قارن إجابتك بالإجابة النموذجية.</p>
            )}
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </section>

      <ol className="questions">
        {quiz.questions.map((q, i) => (
          <QuestionCard
            key={q.id}
            index={i}
            question={q}
            answer={answers[q.id] ?? null}
            submitted={result !== null}
            onAnswer={(a) => setAnswer(q.id, a)}
          />
        ))}
      </ol>

      {result ? (
        <button className="btn" onClick={retry}>
          حاول تاني
        </button>
      ) : (
        <button className="btn" onClick={() => void submit()} disabled={saving}>
          سلّم الإجابات
        </button>
      )}

      {attempts.length > 0 && (
        <section className="card">
          <h2>محاولاتك السابقة</h2>
          <table className="table">
            <tbody>
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td>
                    {new Date(a.created_at).toLocaleString('ar-EG-u-nu-latn', { dateStyle: 'medium', timeStyle: 'short' })}
                  </td>
                  <td className="num">
                    {a.score} من {a.max_score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function QuestionCard({
  index,
  question: q,
  answer,
  submitted,
  onAnswer,
}: {
  index: number;
  question: QuizQuestion;
  answer: Answer;
  submitted: boolean;
  onAnswer: (a: Answer) => void;
}) {
  const ok = submitted ? isCorrect(q, answer) : null;
  const cls = ok === true ? 'question correct' : ok === false ? 'question wrong' : 'question';

  return (
    <li className={cls}>
      <p className="question-text">
        <span className="muted">{index + 1}. </span>
        {q.text}
      </p>

      {q.type === 'mcq' && (
        <div className="options">
          {q.choices.map((c, i) => (
            <label
              key={i}
              className={['option', answer === i && 'selected', submitted && i === q.answer && 'right']
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="radio"
                name={q.id}
                checked={answer === i}
                disabled={submitted}
                onChange={() => onAnswer(i)}
              />
              {c}
            </label>
          ))}
        </div>
      )}

      {q.type === 'true_false' && (
        <div className="options two">
          {[true, false].map((v) => (
            <label
              key={String(v)}
              className={['option', answer === v && 'selected', submitted && v === q.answer && 'right']
                .filter(Boolean)
                .join(' ')}
            >
              <input
                type="radio"
                name={q.id}
                checked={answer === v}
                disabled={submitted}
                onChange={() => onAnswer(v)}
              />
              {v ? 'صح' : 'غلط'}
            </label>
          ))}
        </div>
      )}

      {q.type === 'fill' && (
        <input
          className="fill-input"
          value={typeof answer === 'string' ? answer : ''}
          disabled={submitted}
          onChange={(e) => onAnswer(e.target.value)}
          aria-label={`إجابة السؤال ${index + 1}`}
        />
      )}

      {q.type === 'essay' && (
        <textarea
          rows={4}
          value={typeof answer === 'string' ? answer : ''}
          disabled={submitted}
          onChange={(e) => onAnswer(e.target.value)}
          aria-label={`إجابة السؤال ${index + 1}`}
        />
      )}

      {submitted && (
        <div className="feedback small">
          {ok === true && <p className="ok">✓ إجابة صحيحة</p>}
          {ok === false && (
            <p className="bad">
              ✗ إجابة غلط
              {q.type === 'fill' && ` · الإجابة: ${q.answer[0]}`}
            </p>
          )}
          {q.type === 'essay' && (
            <p>
              <strong>الإجابة النموذجية: </strong>
              {q.modelAnswer}
            </p>
          )}
          {'explanation' in q && q.explanation && <p className="muted">{q.explanation}</p>}
        </div>
      )}
    </li>
  );
}
