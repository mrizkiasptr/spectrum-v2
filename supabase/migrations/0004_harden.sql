-- SPEctrum v2 · hardening (from Supabase security advisors)
-- 1. Access helpers move to a `private` schema that the REST API doesn't expose, so they can't be
--    called as /rest/v1/rpc/... ; policies call them from there.
-- 2. Only signed-in people may call link_member; nobody may call trigger functions directly.
-- 3. Trigger functions get a fixed search_path.

create schema if not exists private;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.members where user_id = auth.uid()), false)
$$;

create or replace function private.has_tribe(p_tribe text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tribe_access ta
    join public.members m on m.id = ta.member_id
    where m.user_id = auth.uid() and ta.tribe = p_tribe
  )
$$;

create or replace function private.is_project_member(p_project text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members pm
    join public.members m on m.id = pm.member_id
    where m.user_id = auth.uid() and pm.project_id = p_project
  )
$$;

create or replace function private.can_read_project(p_project text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin()
      or private.is_project_member(p_project)
      or exists (select 1 from public.projects p where p.id = p_project and private.has_tribe(p.tribe))
$$;

create or replace function private.can_write_project(p_project text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.is_admin() or private.is_project_member(p_project)
$$;

revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;

-- Re-point every policy at the private helpers.
drop policy if exists members_admin on public.members;
create policy members_admin on public.members for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists tribe_access_admin on public.tribe_access;
create policy tribe_access_admin on public.tribe_access for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated
  using (private.is_admin() or private.has_tribe(tribe) or private.is_project_member(id));
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
  with check (private.is_admin() or private.has_tribe(tribe));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (private.can_write_project(id))
  with check (private.is_admin() or private.has_tribe(tribe) or private.is_project_member(id));
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete to authenticated using (private.is_admin());

drop policy if exists project_members_read on public.project_members;
create policy project_members_read on public.project_members for select to authenticated
  using (private.can_read_project(project_id));

do $$
declare t text;
begin
  foreach t in array array['sprints', 'work_items', 'retro_items', 'docs'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (private.can_read_project(project_id))', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (private.can_write_project(project_id)) with check (private.can_write_project(project_id))', t, t);
  end loop;
end $$;

drop policy if exists holidays_admin on public.holidays;
create policy holidays_admin on public.holidays for all to authenticated using (private.is_admin()) with check (private.is_admin());

drop function if exists public.can_read_project(text);
drop function if exists public.can_write_project(text);
drop function if exists public.is_project_member(text);
drop function if exists public.has_tribe(text);
drop function if exists public.is_admin();
drop function if exists public.current_member_id();

-- link_member is the one RPC the app calls, and only when signed in.
revoke all on function public.link_member(text, text) from public, anon;
grant execute on function public.link_member(text, text) to authenticated;

-- Trigger functions run from triggers only.
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.sync_project_members() from public, anon, authenticated;

alter function public.touch_updated_at() set search_path = '';
alter function public.touch_row() set search_path = '';
alter function public.touch_member() set search_path = '';
