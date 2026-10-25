-- Lets admins delete a user from the site without exposing the service_role key.
-- Deleting the auth user cascades to profiles and every per-user table.
-- SECURITY DEFINER is intentional (only the definer can delete from auth.users);
-- the function itself enforces who may call it and on whom.
create function public.admin_delete_user(target uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'only admins can delete users';
  end if;
  if target = (select auth.uid()) then
    raise exception 'admins cannot delete themselves';
  end if;
  if exists (select 1 from public.profiles where id = target and role = 'admin') then
    raise exception 'demote the admin before deleting';
  end if;
  delete from auth.users where id = target;
  if not found then
    raise exception 'user not found';
  end if;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
