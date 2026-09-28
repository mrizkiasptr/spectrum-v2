# Database tests

Checks the migrations and Row Level Security without a Supabase project.

## RLS scenarios (plain Postgres)

`00_stub_supabase.sql` adds minimal stand-ins for Supabase's `auth` schema and roles, then
`rls_test.sql` plays admin, tribe lead, project member, outsider, and new sign-ins against the
policies (22 checks). Needs a local Postgres 15+:

```bash
sudo -u postgres bash supabase/tests/run.sh
# … ok  admin sees all projects … ALL RLS TESTS PASSED
```

## Sync engine against PostgREST

`src/sync/engine.int.test.ts` runs the real `SyncEngine` + supabase-js against PostgREST on top of
the same database (seeding, edits, deletes, and refused writes). It is skipped unless `SB_IT_REST`
is set:

```bash
# database "sbe2e" with the migrations, an `authenticator` role, and two users — see the test header
postgrest postgrest.conf   # db-uri → sbe2e, jwt-secret = $SB_IT_JWT_SECRET, server-port 3001
SB_IT_REST=http://localhost:3001 SB_IT_JWT_SECRET=... npx vitest run src/sync/engine.int.test.ts
```
