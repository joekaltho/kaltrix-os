#!/usr/bin/env bash
# Inventory concurrency tests. Real parallel database sessions.
#
# Run ONLY against a scratch Postgres that already has supabase/tests/harness.sql
# and the inventory migration applied (see supabase/tests/README.md). Uses the
# standard libpq env vars: PGHOST PGPORT PGUSER PGDATABASE.
set -u
UID_A='a0000000-0000-0000-0000-00000000000a'
BIZ='b1000000-0000-0000-0000-00000000000a'
fail=0
q() { psql -X -q -t -A -v ON_ERROR_STOP=1 "$@"; }
asA() {  # asA "<sql>" : run as authenticated user A, print result/error code
  psql -X -q -t -A <<SQL 2>&1 | tr -d '\n' | sed 's/^psql:[^ ]* //; s/^ERROR:  //'
set role authenticated;
select set_config('request.jwt.claim.sub', '$UID_A', false);
$1
SQL
  echo
}
export -f asA; export UID_A
check() { if [ "$2" = "$3" ]; then echo "PASS: $1"; else echo "FAIL: $1 (expected '$3', got '$2')"; fail=1; fi; }

q <<SQL >/dev/null
truncate public.businesses cascade;
insert into public.businesses (id, user_id) values ('$BIZ', '$UID_A');
insert into public.listings (id, business_id, name) values
  ('c1000000-0000-0000-0000-000000000001', '$BIZ', 'Race A'),
  ('c1000000-0000-0000-0000-000000000002', '$BIZ', 'Race B'),
  ('c1000000-0000-0000-0000-000000000003', '$BIZ', 'Race C'),
  ('c1000000-0000-0000-0000-000000000004', '$BIZ', 'Race D');
SQL
L1=c1000000-0000-0000-0000-000000000001; L2=c1000000-0000-0000-0000-000000000002
L3=c1000000-0000-0000-0000-000000000003; L4=c1000000-0000-0000-0000-000000000004
bal() { q -c "select quantity from public.inventory_items where listing_id = '$1'"; }
mvs() { q -c "select count(*) from public.inventory_movements where listing_id = '$1'"; }

# A) 40 receives + 40 issues of 1, fired concurrently, on a balance of 50
asA "select public.inventory_enable_tracking('$L1', 50);" >/dev/null
{ for i in $(seq 1 40); do echo "select public.inventory_receive_stock('$L1', 1);"; done
  for i in $(seq 1 40); do echo "select public.inventory_issue_stock('$L1', 1);"; done; } \
  | xargs -d '\n' -P 16 -I{} bash -c 'asA "$1"' _ {} > /tmp/inv_race_a.txt
check "A) all 80 calls returned a success payload" "$(grep -o '"duplicate"' /tmp/inv_race_a.txt | wc -l)" "80"
check "A) no call errored" "$(grep -oi 'error\|insufficient\|not_found' /tmp/inv_race_a.txt | wc -l)" "0"
check "A) 80 concurrent +1/-1 leave the balance at 50" "$(bal $L1)" "50"
check "A) every operation left exactly one movement (1 opening + 80)" "$(mvs $L1)" "81"
check "A) movement chain stayed continuous under concurrency" "$(q -c "
  select count(*) from (select balance_before, lag(balance_after) over (order by created_at, id) p
  from public.inventory_movements where listing_id='$L1') s where p is not null and p <> balance_before")" "0"
check "A) balance equals sum of history" "$(q -c "select coalesce(sum(quantity_change),0) from public.inventory_movements where listing_id='$L1'")" "50"

# B) two issues of 7 against a balance of 10: exactly one may win
asA "select public.inventory_enable_tracking('$L2', 10);" >/dev/null
printf '%s\n' "select public.inventory_issue_stock('$L2', 7);" "select public.inventory_issue_stock('$L2', 7);" \
  | xargs -d '\n' -P 2 -I{} bash -c 'asA "$1"' _ {} > /tmp/inv_race_b.txt
check "B) exactly one of two competing issues succeeded" "$(grep -o '"duplicate"' /tmp/inv_race_b.txt | wc -l)" "1"
check "B) the loser got insufficient_stock" "$(grep -o 'insufficient_stock' /tmp/inv_race_b.txt | wc -l)" "1"
check "B) balance is 3, never negative" "$(bal $L2)" "3"

# C) the same submit fired 10 times at once (double-click / retry storm)
asA "select public.inventory_enable_tracking('$L3', 0);" >/dev/null
for i in $(seq 1 10); do echo "select public.inventory_receive_stock('$L3', 5, 'supplier', null, null, 'same-submit-key-1');"; done \
  | xargs -d '\n' -P 10 -I{} bash -c 'asA "$1"' _ {} > /tmp/inv_race_c.txt
check "C) all 10 identical submits returned a payload" "$(grep -o '"duplicate"' /tmp/inv_race_c.txt | wc -l)" "10"
check "C) exactly one was the original, 9 were duplicates" "$(grep -o '"duplicate": true' /tmp/inv_race_c.txt | wc -l)" "9"
check "C) 10 simultaneous identical submits applied once" "$(bal $L3)" "5"
check "C) ... and wrote one movement" "$(mvs $L3)" "1"

# D) two adjustments based on the same displayed balance: only the first may apply
asA "select public.inventory_enable_tracking('$L4', 10);" >/dev/null
printf '%s\n' "select public.inventory_adjust_stock('$L4', 20, 'stock_count', null, 10);" \
              "select public.inventory_adjust_stock('$L4', 30, 'stock_count', null, 10);" \
  | xargs -d '\n' -P 2 -I{} bash -c 'asA "$1"' _ {} > /tmp/inv_race_d.txt
check "D) exactly one stale-based adjustment applied" "$(grep -o '"duplicate"' /tmp/inv_race_d.txt | wc -l)" "1"
check "D) the other was refused as stale_balance" "$(grep -o 'stale_balance' /tmp/inv_race_d.txt | wc -l)" "1"
case "$(bal $L4)" in 20|30) echo "PASS: D) balance is one of the two counted values ($(bal $L4))";; *) echo "FAIL: D) unexpected balance $(bal $L4)"; fail=1;; esac

if [ "$fail" = 0 ]; then echo "ALL INVENTORY CONCURRENCY TESTS PASSED"; else echo "SOME CONCURRENCY TESTS FAILED"; exit 1; fi
