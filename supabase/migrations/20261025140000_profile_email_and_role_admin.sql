-- Role management from the site: admins list users by email and change roles.

-- Copy of auth.users.email so admins can identify users (RLS already limits
-- reading profiles to the owner and admins). Kept in sync by triggers only.
alter table public.profiles add column email text;

update public.profiles p set email = u.email
from auth.users u
where u.id = p.id;

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, email)
  values (
    new.id,
    nullif(left(trim(new.raw_user_meta_data ->> 'display_name'), 100), ''),
    new.email
  );
  return new;
end;
$$;

create function private.sync_profile_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.profiles set email = new.email where id = new.id;
  return new;
end;
$$;
revoke all on function private.sync_profile_email() from public, anon, authenticated;

create trigger on_auth_user_email_updated
  after update of email on auth.users
  for each row
  when (old.email is distinct from new.email)
  execute function private.sync_profile_email();

-- Clients may only write these columns; email, id and timestamps are server-managed.
-- role stays writable so admins can change it; the guard trigger blocks everyone else.
revoke update on public.profiles from authenticated;
grant update (display_name, madhhab, show_french, active_grade, role) on public.profiles to authenticated;

-- Same guard as before, plus: the last admin cannot be demoted (no lock-out).
create or replace function private.guard_profile_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'profile id cannot be changed';
  end if;
  if new.role is distinct from old.role then
    if (select auth.uid()) is not null and not private.is_admin() then
      raise exception 'only admins can change roles';
    end if;
    if old.role = 'admin' and not exists (
      select 1 from public.profiles where role = 'admin' and id <> old.id
    ) then
      raise exception 'cannot remove the last admin';
    end if;
  end if;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;
