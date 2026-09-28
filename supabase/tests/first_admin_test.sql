\set ON_ERROR_STOP 1
\c sbtest
-- Runs on a workspace with no admin yet.
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000f1','first@spe.id'),('00000000-0000-0000-0000-0000000000f2','second@spe.id');
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","email":"first@spe.id"}', false);
do $$ begin if not (select (public.link_member('First','FI')).is_admin) then raise exception 'FAIL: first sign-in is not admin'; end if; raise notice 'ok  first sign-in becomes admin'; end $$;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","email":"second@spe.id"}', false);
do $$ begin if (select (public.link_member('Second','SE')).is_admin) then raise exception 'FAIL: second sign-in became admin'; end if; raise notice 'ok  later sign-ins are not admin'; end $$;
reset role;
