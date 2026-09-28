#!/usr/bin/env bash
# Runs the migrations and RLS scenarios against a local Postgres (no Supabase needed).
# Usage: sudo -u postgres bash supabase/tests/run.sh
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
psql -q -v ON_ERROR_STOP=1 -f "$here/00_stub_supabase.sql"
for f in "$here"/../migrations/*.sql; do psql -q -v ON_ERROR_STOP=1 -d sbtest -f "$f"; done
psql -q -d sbtest -c 'grant usage on schema public to authenticated; grant all on all tables in schema public to authenticated;'
psql -q -f "$here/rls_test.sql" 2>&1 | grep -E 'NOTICE|ERROR|PASSED' | sed 's/.*NOTICE:  //'
