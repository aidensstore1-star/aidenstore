#!/usr/bin/env bash
# Tests the database migrations on a throwaway local Postgres: loads a small
# stand-in for Supabase's own schemas, the migrations and the seed, then runs
# the access checks in supabase/tests. Needs Postgres 15 or newer installed
# (initdb, pg_ctl, psql). Run with `npm run db:test`.
set -euo pipefail

cd "$(dirname "$0")/.."
BIN="${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1)}"
BIN="${BIN:-$(dirname "$(command -v initdb)")}"
WORK="$(mktemp -d)"
PORT=54329

# Postgres refuses to run as root; use the postgres user when we are root.
as_pg=()
if [ "$(id -u)" = 0 ]; then
  as_pg=(runuser -u postgres --)
  chown postgres "$WORK"
fi

cleanup() {
  "${as_pg[@]}" "$BIN/pg_ctl" -D "$WORK/data" -m immediate stop >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

"${as_pg[@]}" "$BIN/initdb" -D "$WORK/data" -U postgres --auth=trust >/dev/null
"${as_pg[@]}" "$BIN/pg_ctl" -D "$WORK/data" -o "-p $PORT -k $WORK -c listen_addresses=''" -l "$WORK/log" -w start >/dev/null

run() { psql -h "$WORK" -p "$PORT" -U postgres -d postgres -X -q -v ON_ERROR_STOP=1 "$@"; }

run -f supabase/tests/supabase-stub.sql
for f in supabase/migrations/*.sql; do run -f "$f"; done
run -f supabase/seed.sql
run -o /dev/null -f supabase/tests/access.test.sql 2>&1 | sed 's/^psql:[^ ]* NOTICE:  /  /'
