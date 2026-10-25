-- migrations.json may map a lesson that is still active (not archived) to the new
-- lessons split off from it. Progress recorded on it before the split must reach the
-- new lessons, but progress recorded after the split must not (it no longer covers
-- them). So each (old -> new) pair is applied at most once per user and remembered.

create table public.lesson_migrations_applied (
  user_id        uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  old_lesson_id  text not null check (char_length(old_lesson_id) between 1 and 100),
  new_lesson_id  text not null check (char_length(new_lesson_id) between 1 and 100),
  applied_at     timestamptz not null default now(),
  primary key (user_id, old_lesson_id, new_lesson_id)
);

alter table public.lesson_migrations_applied enable row level security;
revoke all on public.lesson_migrations_applied from anon;
grant select, insert on public.lesson_migrations_applied to authenticated;

create policy "lesson_migrations_applied: read own or admin" on public.lesson_migrations_applied
  for select to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

create policy "lesson_migrations_applied: insert own" on public.lesson_migrations_applied
  for insert to authenticated
  with check (user_id = (select auth.uid()));

-- {"old": ["new", ...]} -> one row per (old_id, new_id) pair.
create function private.lesson_migration_pairs(mappings jsonb)
returns table (old_id text, new_id text)
language sql
immutable
set search_path = ''
as $$
  select distinct m.key, t.value
  from jsonb_each(mappings) as m
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(m.value) = 'array' then m.value else jsonb_build_array(m.value) end
  ) as t(value);
$$;
revoke all on function private.lesson_migration_pairs(jsonb) from public, anon;
grant execute on function private.lesson_migration_pairs(jsonb) to authenticated;

-- Same contract as before (copy, never overwrite, never delete; works whether the old
-- lesson is archived or not), now limited to pairs this user has not been through.
create or replace function public.apply_lesson_migrations(mappings jsonb)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  copied integer;
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if jsonb_typeof(mappings) is distinct from 'object' then
    raise exception 'mappings must be a JSON object';
  end if;

  insert into public.lesson_progress
    (user_id, lesson_id, status, memorized, studied_at, last_revised_at, revision_count)
  select distinct on (pp.new_id)
    uid, pp.new_id, p.status, p.memorized, p.studied_at, p.last_revised_at, p.revision_count
  from private.lesson_migration_pairs(mappings) pp
  join public.lesson_progress p
    on p.user_id = uid and p.lesson_id = pp.old_id
  where not exists (
      select 1 from public.lesson_migrations_applied a
      where a.user_id = uid and a.old_lesson_id = pp.old_id and a.new_lesson_id = pp.new_id
    )
    -- Only real progress is worth copying; an untouched row carries nothing.
    and (p.status <> 'not_started' or p.memorized)
  -- If two old lessons merge into one new lesson, take the most advanced progress.
  order by pp.new_id,
    array_position(array['not_started', 'studied', 'revised', 'mastered'], p.status) desc,
    p.memorized desc
  on conflict (user_id, lesson_id) do nothing;
  get diagnostics copied = row_count;

  -- Remember every pair, copied or not, so later progress on a still-active old
  -- lesson is never carried over again.
  insert into public.lesson_migrations_applied (user_id, old_lesson_id, new_lesson_id)
  select uid, pp.old_id, pp.new_id from private.lesson_migration_pairs(mappings) pp
  on conflict do nothing;

  return copied;
end;
$$;
