-- public.rls_auto_enable() is the event-trigger function behind Supabase's
-- "auto-enable RLS" project option. It is SECURITY DEFINER and exposed under /rpc,
-- so revoke EXECUTE from API roles (event triggers keep firing without it).
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;
