-- SPEctrum v2 · shared workspace
-- Board data moves from each browser into these tables so a team sees one board.
--
-- Shape: every entity table keeps the columns that access rules and queries need
-- (id, project, tribe, status…) plus `data jsonb`, the full entity as the app uses it.
-- That keeps the schema stable while the product evolves (workflow columns, criteria…).
--
-- Access (Row Level Security):
--   * admin            → everything
--   * tribe access     → read every project in that tribe (tribe dashboards)
--   * project member   → read and edit that project, its sprints, tasks, retro, docs
--   * create a project → admins, or people with access to the project's tribe
--   * holidays         → everyone reads, admins edit
--   * members/access   → everyone reads, admins edit; people link themselves by email

-- ---------- People ----------
create table if not exists public.members (
  id          text primary key,
  user_id     uuid unique references auth.users (id) on delete set null,
  email       text unique check (email = lower(email)),
  name        text not null,
  initials    text not null default '',
  role        text not null default '',
  is_admin    boolean not null default false,
  updated_at  timestamptz not null default now()
);

create table if not exists public.tribe_access (
  member_id  text not null references public.members (id) on delete cascade,
  tribe      text not null check (tribe in ('Analyst', 'Andromeda', 'Phoenix', 'Ursa Major')),
  primary key (member_id, tribe)
);

-- ---------- Board ----------
create table if not exists public.projects (
  id          text primary key,
  tribe       text not null check (tribe in ('Analyst', 'Andromeda', 'Phoenix', 'Ursa Major')),
  status      text not null default 'active',
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);

-- Who is on a project; kept in sync with projects.data->'memberIds' by a trigger.
create table if not exists public.project_members (
  project_id  text not null references public.projects (id) on delete cascade,
  member_id   text not null,
  primary key (project_id, member_id)
);
create index if not exists project_members_member_idx on public.project_members (member_id);

create table if not exists public.sprints (
  id          text primary key,
  project_id  text not null references public.projects (id) on delete cascade,
  status      text not null default 'draft',
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);
create index if not exists sprints_project_idx on public.sprints (project_id);

create table if not exists public.work_items (
  id          text primary key,
  project_id  text not null references public.projects (id) on delete cascade,
  sprint_id   text,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);
create index if not exists work_items_project_idx on public.work_items (project_id);
create index if not exists work_items_sprint_idx on public.work_items (sprint_id);

create table if not exists public.retro_items (
  id          text primary key,
  project_id  text not null references public.projects (id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);
create index if not exists retro_items_project_idx on public.retro_items (project_id);

create table if not exists public.docs (
  id          text primary key,
  project_id  text not null references public.projects (id) on delete cascade,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);
create index if not exists docs_project_idx on public.docs (project_id);

create table if not exists public.holidays (
  id          text primary key,
  data        jsonb not null,
  updated_at  timestamptz not null default now(),
  updated_by  uuid default auth.uid()
);

-- ---------- Helpers (security definer so policies don't recurse) ----------
create or replace function public.current_member_id()
returns text language sql stable security definer set search_path = '' as $$
  select id from public.members where user_id = auth.uid()
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.members where user_id = auth.uid()), false)
$$;

create or replace function public.has_tribe(p_tribe text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tribe_access ta
    join public.members m on m.id = ta.member_id
    where m.user_id = auth.uid() and ta.tribe = p_tribe
  )
$$;

create or replace function public.is_project_member(p_project text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.project_members pm
    join public.members m on m.id = pm.member_id
    where m.user_id = auth.uid() and pm.project_id = p_project
  )
$$;

create or replace function public.can_read_project(p_project text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin()
      or public.is_project_member(p_project)
      or exists (select 1 from public.projects p where p.id = p_project and public.has_tribe(p.tribe))
$$;

create or replace function public.can_write_project(p_project text)
returns boolean language sql stable security definer set search_path = '' as $$
  select public.is_admin() or public.is_project_member(p_project)
$$;

-- ---------- Triggers ----------
create or replace function public.touch_row()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;

create or replace function public.touch_member()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['projects', 'sprints', 'work_items', 'retro_items', 'docs', 'holidays'] loop
    execute format('drop trigger if exists %I_touch on public.%I', t, t);
    execute format('create trigger %I_touch before insert or update on public.%I for each row execute function public.touch_row()', t, t);
  end loop;
end $$;

drop trigger if exists members_touch on public.members;
create trigger members_touch before update on public.members for each row execute function public.touch_member();

create or replace function public.sync_project_members()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  delete from public.project_members where project_id = new.id;
  insert into public.project_members (project_id, member_id)
  select new.id, jsonb_array_elements_text(coalesce(new.data -> 'memberIds', '[]'::jsonb))
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists projects_members_sync on public.projects;
create trigger projects_members_sync after insert or update of data on public.projects
  for each row execute function public.sync_project_members();

-- Link the signed-in person to their member row: by user id, then by the (verified) email an
-- admin set up for them, otherwise create a new member. Returns the member.
create or replace function public.link_member(p_name text, p_initials text)
returns public.members
language plpgsql security definer set search_path = '' as $$
declare
  m public.members;
  v_email text := auth.jwt() ->> 'email';
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into m from public.members where user_id = auth.uid();
  if found then return m; end if;

  update public.members set user_id = auth.uid()
  where user_id is null and v_email is not null and email = lower(v_email)
  returning * into m;
  if found then return m; end if;

  insert into public.members (id, user_id, email, name, initials)
  values ('u-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12), auth.uid(), lower(v_email), p_name, p_initials)
  returning * into m;
  return m;
end $$;

grant execute on function public.link_member(text, text) to authenticated;

-- ---------- Row Level Security ----------
alter table public.members         enable row level security;
alter table public.tribe_access    enable row level security;
alter table public.projects        enable row level security;
alter table public.project_members enable row level security;
alter table public.sprints         enable row level security;
alter table public.work_items      enable row level security;
alter table public.retro_items     enable row level security;
alter table public.docs            enable row level security;
alter table public.holidays        enable row level security;

-- members & tribe access: read for everyone signed in, admins manage
drop policy if exists members_read on public.members;
create policy members_read on public.members for select to authenticated using (true);
drop policy if exists members_admin on public.members;
create policy members_admin on public.members for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists tribe_access_read on public.tribe_access;
create policy tribe_access_read on public.tribe_access for select to authenticated using (true);
drop policy if exists tribe_access_admin on public.tribe_access;
create policy tribe_access_admin on public.tribe_access for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- projects
drop policy if exists projects_read on public.projects;
create policy projects_read on public.projects for select to authenticated
  using (public.is_admin() or public.has_tribe(tribe) or public.is_project_member(id));
drop policy if exists projects_insert on public.projects;
create policy projects_insert on public.projects for insert to authenticated
  with check (public.is_admin() or public.has_tribe(tribe));
drop policy if exists projects_update on public.projects;
create policy projects_update on public.projects for update to authenticated
  using (public.can_write_project(id))
  with check (public.is_admin() or public.has_tribe(tribe) or public.is_project_member(id));
drop policy if exists projects_delete on public.projects;
create policy projects_delete on public.projects for delete to authenticated using (public.is_admin());

drop policy if exists project_members_read on public.project_members;
create policy project_members_read on public.project_members for select to authenticated
  using (public.can_read_project(project_id));

-- project children: read with the project, edit as a project member
do $$
declare t text;
begin
  foreach t in array array['sprints', 'work_items', 'retro_items', 'docs'] loop
    execute format('drop policy if exists %I_read on public.%I', t, t);
    execute format('create policy %I_read on public.%I for select to authenticated using (public.can_read_project(project_id))', t, t);
    execute format('drop policy if exists %I_write on public.%I', t, t);
    execute format('create policy %I_write on public.%I for all to authenticated using (public.can_write_project(project_id)) with check (public.can_write_project(project_id))', t, t);
  end loop;
end $$;

-- holidays
drop policy if exists holidays_read on public.holidays;
create policy holidays_read on public.holidays for select to authenticated using (true);
drop policy if exists holidays_admin on public.holidays;
create policy holidays_admin on public.holidays for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------- Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['members', 'tribe_access', 'projects', 'sprints', 'work_items', 'retro_items', 'docs', 'holidays'] loop
    if not exists (
      select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
