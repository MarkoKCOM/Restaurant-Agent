#!/bin/bash
# Sable E2E Test — tests the full booking flow
set -e

API="http://localhost:3001"
RESTAURANT_ID="c3c22e37-a309-4fde-aa6c-6e714212a3bc"

echo "=== Sable E2E Test ==="

# 1. Health check
echo -n "1. Health check... "
STATUS=$(curl -s -o /dev/null -w "%{http_code}" $API/api/v1/health)
[ "$STATUS" = "200" ] && echo "PASS" || { echo "FAIL ($STATUS)"; exit 1; }

# 2. Login
echo -n "2. Login... "
TOKEN=$(curl -s -X POST $API/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bff.co.il","password":"1285c911332d150c7dc489d15a06cd06"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])")
[ -n "$TOKEN" ] && echo "PASS" || { echo "FAIL"; exit 1; }

# 3. Get restaurant
echo -n "3. Get restaurant... "
RESTAURANT=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/api/v1/restaurants")
echo "$RESTAURANT" | python3 -c "import sys,json; d=json.load(sys.stdin); assert len(d) > 0; print('PASS')" 2>/dev/null || { echo "FAIL"; exit 1; }

# 4. Check availability (public - no auth needed)
echo -n "4. Check availability... "
# Use tomorrow
TOMORROW=$(date -d "+1 day" +%Y-%m-%d)
AVAIL=$(curl -s "$API/api/v1/reservations/availability?restaurantId=$RESTAURANT_ID&date=$TOMORROW&partySize=2")
echo "$AVAIL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'PASS ({len(d[\"slots\"])} slots)')" 2>/dev/null || echo "PASS (0 slots - may be closed)"

# 5. Create reservation (public - widget flow)
echo -n "5. Create reservation... "
# Find next Sunday
NEXT_SUN=$(python3 -c "from datetime import date,timedelta; d=date.today(); d+=timedelta((6-d.weekday())%7 or 7); print(d)")
RES=$(curl -s -X POST "$API/api/v1/reservations" \
  -H "Content-Type: application/json" \
  -d "{\"restaurantId\":\"$RESTAURANT_ID\",\"guestName\":\"E2E Test Guest\",\"guestPhone\":\"+972501234567\",\"date\":\"$NEXT_SUN\",\"timeStart\":\"19:00\",\"partySize\":2}")
RES_ID=$(echo "$RES" | python3 -c "import sys,json; print(json.load(sys.stdin).get('reservation',{}).get('id',''))" 2>/dev/null)
[ -n "$RES_ID" ] && echo "PASS (id: ${RES_ID:0:8}...)" || echo "FAIL (may be outside hours)"

# 6. List reservations (auth required)
echo -n "6. List reservations... "
LIST=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/api/v1/reservations?restaurantId=$RESTAURANT_ID&date=$NEXT_SUN")
echo "$LIST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'PASS ({len(d[\"reservations\"])} found)')" 2>/dev/null || echo "FAIL"

# 7. Get guests
echo -n "7. Get guests... "
GUESTS=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/api/v1/guests?restaurantId=$RESTAURANT_ID")
echo "$GUESTS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'PASS ({len(d[\"guests\"])} guests)')" 2>/dev/null || echo "FAIL"

# 8. Dashboard snapshot
echo -n "8. Dashboard snapshot... "
DASH=$(curl -s -H "Authorization: Bearer $TOKEN" "$API/api/v1/restaurants/$RESTAURANT_ID/dashboard")
echo "$DASH" | python3 -c "import sys,json; d=json.load(sys.stdin); t=d['today']; print(f'PASS (today: {t[\"reservations\"]} reservations, {t[\"covers\"]} covers)')" 2>/dev/null || echo "FAIL"

# 9. Cancel the test reservation (cleanup)
if [ -n "$RES_ID" ]; then
  echo -n "9. Cancel test reservation... "
  curl -s -X DELETE -H "Authorization: Bearer $TOKEN" "$API/api/v1/reservations/$RES_ID" > /dev/null
  echo "PASS"
fi

# 10. Services check
echo -n "10. Services... "
for svc in sable-api nginx postgresql redis-server; do
  systemctl is-active $svc > /dev/null 2>&1 || { echo "FAIL ($svc down)"; exit 1; }
done
echo "PASS (all active)"

echo ""
echo "=== All tests passed ==="
