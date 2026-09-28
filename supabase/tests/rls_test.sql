\set ON_ERROR_STOP 1
\c sbtest
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-00000000000a','admin@spe.id'),('00000000-0000-0000-0000-00000000000b','tribe@spe.id'),
 ('00000000-0000-0000-0000-00000000000c','pm@spe.id'),('00000000-0000-0000-0000-00000000000d','out@spe.id'),
 ('00000000-0000-0000-0000-00000000000e','new.hire@spe.id'),('00000000-0000-0000-0000-00000000000f','stranger@spe.id');
insert into members(id,user_id,email,name,is_admin) values
 ('m-a','00000000-0000-0000-0000-00000000000a','admin@spe.id','Admin',true),
 ('m-t','00000000-0000-0000-0000-00000000000b','tribe@spe.id','Tribe Lead',false),
 ('m-p','00000000-0000-0000-0000-00000000000c','pm@spe.id','Project Member',false),
 ('m-o','00000000-0000-0000-0000-00000000000d','out@spe.id','Outsider',false),
 ('m-x',null,'new.hire@spe.id','New Hire',false);
insert into tribe_access values ('m-t','Phoenix');

create or replace function as_user(u text, email text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', u, false);
  perform set_config('request.jwt.claims', json_build_object('sub',u,'email',email)::text, false);
end $$;
grant execute on function as_user(text,text) to authenticated;

create or replace function expect(label text, ok boolean) returns void language plpgsql as $$
begin
  if not ok then raise exception 'FAIL: %', label; end if;
  raise notice 'ok  %', label;
end $$;
grant execute on function expect(text,boolean) to authenticated;

set role authenticated;

-- admin creates two projects
select as_user('00000000-0000-0000-0000-00000000000a','admin@spe.id');
insert into projects(id,tribe,status,data) values
 ('p1','Phoenix','active','{"id":"p1","memberIds":["m-p"]}'),
 ('p2','Analyst','active','{"id":"p2","memberIds":[]}');
select expect('admin sees all projects', (select count(*) from projects) = 2);
select expect('trigger synced project_members', (select count(*) from project_members where project_id='p1' and member_id='m-p') = 1);

-- tribe access: reads its tribe, cannot edit others' projects, can create in its tribe only
select as_user('00000000-0000-0000-0000-00000000000b','tribe@spe.id');
select expect('tribe lead sees only Phoenix', (select array_agg(id) from projects) = array['p1']);
with u as (update projects set status='completed' where id='p1' returning 1) select expect('tribe lead cannot edit p1', (select count(*) from u)=0);
insert into projects(id,tribe,status,data) values ('p3','Phoenix','active','{"id":"p3","memberIds":["m-t"]}');
select expect('tribe lead created p3 and can read it', exists(select 1 from projects where id='p3'));
insert into sprints(id,project_id,status,data) values ('s3','p3','draft','{}');
select expect('tribe lead adds sprint to own project', exists(select 1 from sprints where id='s3'));
do $$ begin
  insert into projects(id,tribe,status,data) values ('p4','Analyst','active','{"memberIds":[]}');
  raise exception 'FAIL: tribe lead created project in another tribe';
exception when insufficient_privilege then raise notice 'ok  tribe lead blocked from other tribe';
end $$;

-- project member: edits its project, not others
select as_user('00000000-0000-0000-0000-00000000000c','pm@spe.id');
select expect('project member sees only p1', (select array_agg(id) from projects) = array['p1']);
insert into sprints(id,project_id,status,data) values ('s1','p1','active','{"n":1}');
insert into work_items(id,project_id,sprint_id,data) values ('i1','p1','s1','{"t":"a"}');
insert into sprints(id,project_id,status,data) values ('s1','p1','active','{"n":2}') on conflict (id) do update set data=excluded.data, status=excluded.status;
select expect('upsert updates sprint', (select data->>'n' from sprints where id='s1')='2');
select expect('updated_by stamped', (select updated_by from sprints where id='s1')='00000000-0000-0000-0000-00000000000c');
do $$ begin
  insert into sprints(id,project_id,status,data) values ('s2','p2','draft','{}');
  raise exception 'FAIL: project member wrote to p2';
exception when insufficient_privilege then raise notice 'ok  project member blocked from p2';
end $$;
with u as (update members set is_admin=true where id='m-p' returning 1) select expect('non-admin cannot promote self', (select count(*) from u)=0);
do $$ begin
  insert into holidays(id,data) values ('h1','{}');
  raise exception 'FAIL: non-admin edited holidays';
exception when insufficient_privilege then raise notice 'ok  non-admin blocked from holidays';
end $$;

-- tribe lead can read p1's sprints (tribe dashboard) but not write them
select as_user('00000000-0000-0000-0000-00000000000b','tribe@spe.id');
select expect('tribe lead reads p1 sprints', (select count(*) from sprints where project_id='p1')=1);
with u as (update work_items set data='{}' where id='i1' returning 1) select expect('tribe lead cannot edit p1 tasks', (select count(*) from u)=0);

-- outsider sees nothing
select as_user('00000000-0000-0000-0000-00000000000d','out@spe.id');
select expect('outsider sees no projects', (select count(*) from projects)=0);
select expect('outsider sees no tasks', (select count(*) from work_items)=0);

-- linking: pre-provisioned email claims its member; unknown email gets a new member
select as_user('00000000-0000-0000-0000-00000000000e','New.Hire@spe.id');
select expect('new hire linked to m-x', (select id from link_member('New Hire','NH'))='m-x');
select expect('link is idempotent', (select id from link_member('x','x'))='m-x');
select as_user('00000000-0000-0000-0000-00000000000f','stranger@spe.id');
select expect('stranger gets a fresh member', (select (m).id like 'u-%' and not (m).is_admin from (select link_member('Stranger','ST') m) q));
select expect('stranger still sees no projects', (select count(*) from projects)=0);

-- admin deletes project → children cascade
select as_user('00000000-0000-0000-0000-00000000000a','admin@spe.id');
delete from projects where id='p1';
select expect('cascade removed tasks', (select count(*) from work_items where project_id='p1')=0);
reset role;
select 'ALL RLS TESTS PASSED';
