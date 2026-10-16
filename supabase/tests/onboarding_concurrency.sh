#!/usr/bin/env bash
# Race test for claim_email_delivery: 8 parallel sessions per business all try
# to claim the same welcome row at once. Exactly ONE may win per business, or a
# welcome email could be sent twice. Run after harness + migrations are applied
# to a scratch DB (default name kx_notif; override with DB=...).
set -euo pipefail
DB="${DB:-kx_notif}"
N="${N:-40}"        # businesses
RACERS="${RACERS:-8}"

psql -d "$DB" -qAt -v ON_ERROR_STOP=1 <<SQL >/dev/null
truncate public.email_deliveries, public.businesses cascade;
insert into public.businesses (user_id, business_name, slug)
  select gen_random_uuid(), 'Race ' || g, 'race-' || g from generate_series(1, $N) g;
SQL

# one line per (business, racer)
psql -d "$DB" -qAt -c "select id from public.businesses" \
  | while read -r id; do for _ in $(seq 1 "$RACERS"); do echo "$id"; done; done \
  | xargs -P $((RACERS * 2)) -I{} psql -d "$DB" -qAt -c \
      "set role service_role; select '{}' || ' ' || count(*) from public.claim_email_delivery('{}', 'welcome');" \
  | grep -E '^[0-9a-f-]{36} [01]$' > /tmp/claims.txt

total_lines=$(wc -l < /tmp/claims.txt)
expected=$((N * RACERS))
[ "$total_lines" -eq "$expected" ] || { echo "FAIL: expected $expected results, got $total_lines"; exit 1; }

bad=$(awk '{s[$1]+=$2} END {for (k in s) if (s[k] != 1) print k, s[k]}' /tmp/claims.txt)
if [ -n "$bad" ]; then echo "FAIL: businesses not claimed exactly once:"; echo "$bad"; exit 1; fi

attempts=$(psql -d "$DB" -qAt -c "select count(*) from public.email_deliveries where attempts <> 1 or status <> 'sending'")
[ "$attempts" -eq 0 ] || { echo "FAIL: $attempts rows with attempts<>1"; exit 1; }

echo "ALL ONBOARDING CONCURRENCY TESTS PASSED ($N businesses x $RACERS racers, each claimed exactly once)"
