-- 1) Second optional subject: Qiraat (for blind students) in the literary track.
--    Subjects carry optionalKey "french" | "qiraat"; each key has its own profile flag.
alter table public.profiles add column show_qiraat boolean not null default false;
grant update (show_qiraat) on public.profiles to authenticated;

-- 2) Carry progress across split/merged lessons (content/grades/<grade>/migrations.json).
--    The site passes the grade's mapping {"old-id": ["new-id", ...]}; for every old
--    lesson the caller has progress on, the progress is copied to each new lesson the
--    caller has no row for yet. Existing rows are never overwritten and old rows are
--    kept, so running it again changes nothing (idempotent).
--    SECURITY INVOKER: runs under the caller's RLS, so it can only touch their own rows.
create function public.apply_lesson_migrations(mappings jsonb)
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
  select distinct on (t.new_id)
    uid, t.new_id, p.status, p.memorized, p.studied_at, p.last_revised_at, p.revision_count
  from jsonb_each(mappings) as m(old_id, targets)
  cross join lateral jsonb_array_elements_text(
    case when jsonb_typeof(m.targets) = 'array' then m.targets else jsonb_build_array(m.targets) end
  ) as t(new_id)
  join public.lesson_progress p
    on p.user_id = uid and p.lesson_id = m.old_id
  -- Only real progress is worth copying; an untouched row carries nothing.
  where p.status <> 'not_started' or p.memorized
  -- If two old lessons merge into one new lesson, take the most advanced progress.
  order by t.new_id,
    array_position(array['not_started', 'studied', 'revised', 'mastered'], p.status) desc,
    p.memorized desc
  on conflict (user_id, lesson_id) do nothing;

  get diagnostics copied = row_count;
  return copied;
end;
$$;

revoke all on function public.apply_lesson_migrations(jsonb) from public, anon;
grant execute on function public.apply_lesson_migrations(jsonb) to authenticated;
