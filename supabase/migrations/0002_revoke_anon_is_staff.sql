-- inv_is_staff() is only needed by RLS policies for signed-in users.
-- Authenticated keeps EXECUTE (policies run as the caller); it only reveals
-- whether the caller is staff.
revoke execute on function public.inv_is_staff() from public, anon;
grant execute on function public.inv_is_staff() to authenticated;
