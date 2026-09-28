-- SPEctrum v2 · first sign-in becomes admin
-- A new workspace has no admin, and only admins can grant access. So the first person to sign in
-- (while no admin exists) is made admin. Sign-up is closed, so that person is someone you created
-- in Authentication › Users.

create or replace function public.link_member(p_name text, p_initials text)
returns public.members
language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
  v_email text := auth.jwt() ->> 'email';
  v_first boolean;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into m from public.members where user_id = auth.uid();
  if found then return m; end if;

  -- Serialize first sign-ins so two people can't both become the first admin.
  lock table public.members in share row exclusive mode;
  v_first := not exists (select 1 from public.members where is_admin);

  update public.members set user_id = auth.uid(), is_admin = is_admin or v_first
  where user_id is null and v_email is not null and email = lower(v_email)
  returning * into m;
  if found then return m; end if;

  insert into public.members (id, user_id, email, name, initials, is_admin)
  values ('u-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), auth.uid(), lower(v_email), p_name, p_initials, v_first)
  returning * into m;
  return m;
end $$;

grant execute on function public.link_member(text, text) to authenticated;
