#!/usr/bin/env node
// Validates content/ so lesson IDs (which user progress is keyed on) stay safe.
//
//   node scripts/check-content.mjs [--base <git-ref>]
//
// Always: lesson IDs present, unique across all grades, prefixed with the grade code;
// subject IDs unique; groups/madhhabs known; migrations and quizzes point at real lessons.
// With --base (or BASE_REF): every lesson ID that existed at <base> still exists (or is
// mapped in migrations.json), and a changed curriculum.json bumps contentVersion.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GRADES_DIR = join(ROOT, 'content', 'grades');
const errors = [];
const err = (msg) => errors.push(msg);

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    err(`${path}: invalid JSON (${e.message})`);
    return null;
  }
}

function lessonsOf(curriculum) {
  const out = [];
  for (const s of curriculum?.subjects ?? []) {
    for (const u of s.units ?? []) {
      for (const l of u.lessons ?? []) out.push({ subject: s.id, lesson: l });
    }
  }
  return out;
}

// Quiz format: plan section 5 (mcq / true_false / fill / essay).
function checkQuiz(where, q, lessonId) {
  if (q.lessonId !== lessonId) err(`${where}: lessonId "${q.lessonId}" != file name`);
  if (!q.quizId) err(`${where}: quizId is missing`);
  if (!Number.isInteger(q.version) || q.version < 1) err(`${where}: version must be a positive integer`);
  if (!q.title) err(`${where}: title is missing`);
  if (!Array.isArray(q.questions) || q.questions.length === 0) {
    err(`${where}: questions must be a non-empty array`);
    return;
  }
  const ids = new Set();
  for (const [i, x] of q.questions.entries()) {
    const at = `${where} question ${x?.id ?? i + 1}`;
    if (!x?.id) err(`${at}: id is missing`);
    else if (ids.has(x.id)) err(`${at}: duplicate question id`);
    ids.add(x?.id);
    if (!x?.text) err(`${at}: text is missing`);
    switch (x?.type) {
      case 'mcq':
        if (!Array.isArray(x.choices) || x.choices.length < 2) err(`${at}: mcq needs at least 2 choices`);
        else if (!Number.isInteger(x.answer) || x.answer < 0 || x.answer >= x.choices.length) {
          err(`${at}: answer must be a choice index (0-${x.choices.length - 1})`);
        }
        break;
      case 'true_false':
        if (typeof x.answer !== 'boolean') err(`${at}: answer must be true or false`);
        break;
      case 'fill':
        if (!Array.isArray(x.answer) || x.answer.length === 0) err(`${at}: answer must be a non-empty array`);
        break;
      case 'essay':
        if (!x.modelAnswer) err(`${at}: modelAnswer is missing`);
        break;
      default:
        err(`${at}: unknown type "${x?.type}"`);
    }
  }
}

const baseArgIdx = process.argv.indexOf('--base');
const base = (baseArgIdx > -1 ? process.argv[baseArgIdx + 1] : process.env.BASE_REF) || '';

// --- Current content -------------------------------------------------------

const index = readJson(join(ROOT, 'content', 'index.json'));
const gradeCodes = new Set((index?.grades ?? []).map((g) => g.code));
for (const g of index?.grades ?? []) {
  if (g.status === 'available') {
    const p = join(GRADES_DIR, g.code, 'curriculum.json');
    if (!existsSync(p)) err(`content/index.json: grade ${g.code} is available but ${p} is missing`);
  }
}

const gradeDirs = existsSync(GRADES_DIR)
  ? readdirSync(GRADES_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name)
  : [];

const allLessonIds = new Map(); // id -> "grade/subject"
const migratedFrom = new Set();
const current = new Map(); // relative path -> { text, json }

for (const grade of gradeDirs) {
  const rel = `content/grades/${grade}/curriculum.json`;
  const path = join(ROOT, rel);
  if (!existsSync(path)) continue;
  const text = readFileSync(path, 'utf8');
  const c = readJson(path);
  if (!c) continue;
  current.set(rel, { text, json: c });

  if (c.gradeCode !== grade) err(`${rel}: gradeCode "${c.gradeCode}" does not match folder "${grade}"`);
  if (!gradeCodes.has(grade)) err(`${rel}: grade "${grade}" is not listed in content/index.json`);
  if (!c.contentVersion) err(`${rel}: contentVersion is missing`);

  const groups = new Set((c.groups ?? []).map((g) => g.id));
  const madhhabs = new Set((c.madhhabs ?? []).map((m) => m.id));
  const subjectIds = new Set();
  for (const s of c.subjects ?? []) {
    if (!s.id) err(`${rel}: a subject has no id`);
    else if (subjectIds.has(s.id)) err(`${rel}: duplicate subject id ${s.id}`);
    subjectIds.add(s.id);
    if (!groups.has(s.group)) err(`${rel}: subject ${s.id} has unknown group "${s.group}"`);
    if (s.madhhab && !madhhabs.has(s.madhhab)) err(`${rel}: subject ${s.id} has unknown madhhab "${s.madhhab}"`);
  }

  for (const { subject, lesson } of lessonsOf(c)) {
    if (!lesson.id) {
      err(`${rel}: lesson "${lesson.title}" in ${subject} has no id`);
      continue;
    }
    if (!lesson.id.startsWith(`${grade}-`)) err(`${rel}: lesson id ${lesson.id} must start with "${grade}-"`);
    const seen = allLessonIds.get(lesson.id);
    if (seen) err(`duplicate lesson id ${lesson.id} (in ${seen} and ${grade}/${subject})`);
    else allLessonIds.set(lesson.id, `${grade}/${subject}`);
    if (lesson.term !== 1 && lesson.term !== 2) err(`${rel}: lesson ${lesson.id} has invalid term ${lesson.term}`);
  }

  const migPath = join(GRADES_DIR, grade, 'migrations.json');
  if (existsSync(migPath)) {
    const mig = readJson(migPath) ?? {};
    for (const [from, to] of Object.entries(mig)) {
      migratedFrom.add(from);
      for (const id of Array.isArray(to) ? to : [to]) {
        if (!lessonsOf(c).some((x) => x.lesson.id === id)) {
          err(`content/grades/${grade}/migrations.json: ${from} -> ${id}, but ${id} does not exist`);
        }
      }
    }
  }

  const quizDir = join(GRADES_DIR, grade, 'quizzes');
  if (existsSync(quizDir)) {
    for (const f of readdirSync(quizDir).filter((x) => x.endsWith('.json'))) {
      const q = readJson(join(quizDir, f));
      const lessonId = f.replace(/\.json$/, '');
      if (!lessonsOf(c).some((x) => x.lesson.id === lessonId)) err(`quiz ${grade}/quizzes/${f}: no lesson ${lessonId}`);
      if (q) checkQuiz(`quiz ${grade}/quizzes/${f}`, q, lessonId);
    }
  }
}

// --- Compare with base ref -------------------------------------------------

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

let compared = false;
if (base && !/^0+$/.test(base)) {
  try {
    git(['cat-file', '-e', `${base}^{commit}`]);
    compared = true;
  } catch {
    console.warn(`warning: base ref "${base}" not found; skipping removed-ID check`);
  }
}

if (compared) {
  const files = git(['ls-tree', '-r', '--name-only', base, '--', 'content/grades'])
    .split('\n')
    .filter((f) => /^content\/grades\/[^/]+\/curriculum\.json$/.test(f));
  for (const rel of files) {
    const text = git(['show', `${base}:${rel}`]);
    let old;
    try {
      old = JSON.parse(text);
    } catch {
      continue; // base itself was broken; nothing to protect
    }
    for (const { lesson } of lessonsOf(old)) {
      if (lesson.id && !allLessonIds.has(lesson.id) && !migratedFrom.has(lesson.id)) {
        err(`lesson id ${lesson.id} existed in ${base}:${rel} and was removed (archive it or add it to migrations.json)`);
      }
    }
    const now = current.get(rel);
    if (now && now.text !== text && now.json.contentVersion === old.contentVersion) {
      err(`${rel} changed but contentVersion is still "${old.contentVersion}"`);
    }
  }
}

// --- Report ----------------------------------------------------------------

if (errors.length) {
  console.error(`Content check failed (${errors.length}):`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(
  `Content OK: ${allLessonIds.size} lessons in ${current.size} grade(s)` +
    (compared ? `, no IDs removed since ${base}` : ''),
);
