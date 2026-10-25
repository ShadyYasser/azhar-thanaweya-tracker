-- Phase 1 schema: profiles, enrollments, lesson_progress, study_log, quiz_attempts.
-- Nothing here is grade-specific: lessons live in content/*.json and are referenced by ID.

-- Helpers live in a schema that is not exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text check (char_length(display_name) <= 100),
  role          text not null default 'student' check (role in ('student', 'admin')),
  madhhab       text check (madhhab in ('hanafi', 'shafei', 'maliki', 'hanbali')),
  show_french   boolean not null default false,
  active_grade  text check (active_grade ~ '^[a-z0-9-]{2,40}$'),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.enrollments (
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  grade_code     text not null check (grade_code ~ '^[a-z0-9-]{2,40}$'),
  academic_year  text check (char_length(academic_year) <= 20),
  started_at     timestamptz not null default now(),
  primary key (user_id, grade_code)
);

create table public.lesson_progress (
  user_id          uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  lesson_id        text not null check (char_length(lesson_id) between 1 and 100),
  status           text not null default 'not_started'
                     check (status in ('not_started', 'studied', 'revised', 'mastered')),
  memorized        boolean not null default false,
  revision_count   int not null default 0 check (revision_count >= 0),
  studied_at       timestamptz,
  last_revised_at  timestamptz,
  confidence       int check (confidence between 1 and 5),
  notes            text check (char_length(notes) <= 5000),
  updated_at       timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table public.study_log (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  lesson_id   text not null check (char_length(lesson_id) between 1 and 100),
  action      text not null check (action in ('study', 'revise', 'recite')),
  minutes     int check (minutes between 0 and 1440),
  created_at  timestamptz not null default now()
);
create index study_log_user_id_created_at_idx on public.study_log (user_id, created_at desc);

create table public.quiz_attempts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  lesson_id     text not null check (char_length(lesson_id) between 1 and 100),
  quiz_id       text not null check (char_length(quiz_id) between 1 and 120),
  quiz_version  int not null default 1,
  score         numeric,
  max_score     numeric,
  answers       jsonb,
  created_at    timestamptz not null default now()
);
create index quiz_attempts_user_id_lesson_id_idx on public.quiz_attempts (user_id, lesson_id);

-- ---------------------------------------------------------------------------
-- Functions and triggers
-- ---------------------------------------------------------------------------

-- True when the current user is an admin. SECURITY DEFINER so policies on
-- profiles can call it without recursing into their own RLS.
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;
revoke all on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- Create the profile row for every new auth user (always as a student).
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 100), ''));
  return new;
end;
$$;
revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Users cannot change their own role (or anyone's) unless they are admins.
-- Requests with no auth.uid() (SQL Editor, service role) are trusted.
create function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profile id cannot be changed';
  end if;
  if new.role is distinct from old.role
     and (select auth.uid()) is not null
     and not private.is_admin() then
    raise exception 'only admins can change roles';
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.guard_profile_update() from public, anon, authenticated;

create trigger profiles_guard_update
  before update on public.profiles
  for each row execute function private.guard_profile_update();

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function private.touch_updated_at() from public, anon, authenticated;

create trigger lesson_progress_touch_updated_at
  before update on public.lesson_progress
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges: only signed-in users reach these tables through the API.
-- ---------------------------------------------------------------------------

revoke all on public.profiles, public.enrollments, public.lesson_progress,
  public.study_log, public.quiz_attempts from anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.enrollments to authenticated;
grant select, insert, update, delete on public.lesson_progress to authenticated;
grant select, insert, delete on public.study_log to authenticated;
grant select, insert on public.quiz_attempts to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security: own rows only; admins can read everything.
-- ---------------------------------------------------------------------------

alter table public.profiles        enable row level security;
alter table public.enrollments     enable row level security;
alter table public.lesson_progress enable row level security;
alter table public.study_log       enable row level security;
alter table public.quiz_attempts   enable row level security;

-- profiles (rows are created by the signup trigger, never by the client)
create policy "profiles: read own or admin" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()));

create policy "profiles: update own or admin" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or (select private.is_admin()))
  with check (id = (select auth.uid()) or (select private.is_admin()));

-- enrollments
create policy "enrollments: read own or admin" on public.enrollments
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "enrollments: insert own" on public.enrollments
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "enrollments: update own" on public.enrollments
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "enrollments: delete own" on public.enrollments
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- lesson_progress
create policy "lesson_progress: read own or admin" on public.lesson_progress
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "lesson_progress: insert own" on public.lesson_progress
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "lesson_progress: update own" on public.lesson_progress
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "lesson_progress: delete own" on public.lesson_progress
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- study_log
create policy "study_log: read own or admin" on public.study_log
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "study_log: insert own" on public.study_log
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "study_log: delete own" on public.study_log
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- quiz_attempts
create policy "quiz_attempts: read own or admin" on public.quiz_attempts
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "quiz_attempts: insert own" on public.quiz_attempts
  for insert to authenticated
  with check (user_id = (select auth.uid()));
