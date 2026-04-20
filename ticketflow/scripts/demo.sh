#!/usr/bin/env bash
# =============================================================================
# TicketFlow End-to-End Demo
# Exercises: register → login → create event → list seats → book → poll status
# =============================================================================
set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:3000}"
POLL_RETRIES=20
POLL_SLEEP=2

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

info()    { echo -e "${CYAN}[demo]${NC} $*"; }
success() { echo -e "${GREEN}[ok]${NC}   $*"; }
warn()    { echo -e "${YELLOW}[warn]${NC} $*"; }
fail()    { echo -e "${RED}[fail]${NC} $*"; exit 1; }

require_jq() {
  command -v jq &>/dev/null || fail "jq is required. Install it with: brew install jq"
}

require_curl() {
  command -v curl &>/dev/null || fail "curl is required."
}

# ---------------------------------------------------------------------------
info "Checking dependencies..."
require_jq
require_curl

# ---------------------------------------------------------------------------
info "Waiting for gateway to be ready at ${BASE_URL}/health ..."
for i in $(seq 1 10); do
  if curl -sf "${BASE_URL}/health" &>/dev/null; then
    success "Gateway is up."
    break
  fi
  if [[ $i -eq 10 ]]; then
    fail "Gateway did not respond after 10 attempts. Is the stack running? Try: make dev"
  fi
  echo "  attempt $i/10..."
  sleep 3
done

# ---------------------------------------------------------------------------
TIMESTAMP=$(date +%s)
EMAIL="demo-user-${TIMESTAMP}@ticketflow.dev"
PASSWORD="Demo1234!"
NAME="Demo User ${TIMESTAMP}"

info "Registering user: ${EMAIL}"
REGISTER_RESP=$(curl -sf -X POST "${BASE_URL}/api/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"${NAME}\",\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
echo "$REGISTER_RESP" | jq .
success "User registered."

# ---------------------------------------------------------------------------
info "Logging in..."
LOGIN_RESP=$(curl -sf -X POST "${BASE_URL}/api/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${EMAIL}\",\"password\":\"${PASSWORD}\"}")
TOKEN=$(echo "$LOGIN_RESP" | jq -r '.token')
[[ -z "$TOKEN" || "$TOKEN" == "null" ]] && fail "Login failed — no token returned."
success "Logged in. Token acquired."

AUTH_HEADER="Authorization: Bearer ${TOKEN}"

# ---------------------------------------------------------------------------
info "Fetching available events..."
EVENTS_RESP=$(curl -sf "${BASE_URL}/api/events" -H "$AUTH_HEADER")
echo "$EVENTS_RESP" | jq '.events[] | {id, name, date, price}'

EVENT_ID=$(echo "$EVENTS_RESP" | jq -r '.events[0].id // empty')
if [[ -z "$EVENT_ID" ]]; then
  warn "No events found. Running seed first..."
  # Attempt to call the seed endpoint if it exists, otherwise skip
  curl -sf -X POST "${BASE_URL}/api/events/seed" -H "$AUTH_HEADER" &>/dev/null || true
  EVENTS_RESP=$(curl -sf "${BASE_URL}/api/events" -H "$AUTH_HEADER")
  EVENT_ID=$(echo "$EVENTS_RESP" | jq -r '.events[0].id // empty')
  [[ -z "$EVENT_ID" ]] && fail "Still no events after seed attempt. Run: make seed"
fi

EVENT_NAME=$(echo "$EVENTS_RESP" | jq -r '.events[0].name')
success "Using event: ${EVENT_NAME} (${EVENT_ID})"

# ---------------------------------------------------------------------------
info "Fetching available seats for event..."
SEATS_RESP=$(curl -sf "${BASE_URL}/api/inventory/events/${EVENT_ID}/seats" -H "$AUTH_HEADER")
AVAILABLE_SEATS=$(echo "$SEATS_RESP" | jq '[.seats[] | select(.status == "AVAILABLE")] | .[0:2]')
echo "$AVAILABLE_SEATS" | jq .

SEAT_IDS=$(echo "$AVAILABLE_SEATS" | jq -r '[.[].id] | @json')
SEAT_COUNT=$(echo "$AVAILABLE_SEATS" | jq 'length')

if [[ "$SEAT_COUNT" -eq 0 ]]; then
  fail "No available seats found for this event."
fi
success "Selected ${SEAT_COUNT} seat(s)."

# ---------------------------------------------------------------------------
info "Creating booking (POST /api/bookings → expecting 202 Accepted)..."
BOOKING_RESP=$(curl -sf -o /tmp/booking_resp.json -w "%{http_code}" \
  -X POST "${BASE_URL}/api/bookings" \
  -H "$AUTH_HEADER" \
  -H "Content-Type: application/json" \
  -d "{\"eventId\":\"${EVENT_ID}\",\"seatIds\":${SEAT_IDS}}")

HTTP_CODE="$BOOKING_RESP"
if [[ "$HTTP_CODE" != "202" ]]; then
  echo "Response body:" && cat /tmp/booking_resp.json
  fail "Expected HTTP 202, got ${HTTP_CODE}"
fi

cat /tmp/booking_resp.json | jq .
BOOKING_ID=$(cat /tmp/booking_resp.json | jq -r '.bookingId // .id // empty')
[[ -z "$BOOKING_ID" ]] && fail "Could not extract bookingId from response."
success "Booking accepted. ID: ${BOOKING_ID}"

# ---------------------------------------------------------------------------
info "Polling booking status (up to $((POLL_RETRIES * POLL_SLEEP))s)..."
FINAL_STATUS=""
for i in $(seq 1 "$POLL_RETRIES"); do
  STATUS_RESP=$(curl -sf "${BASE_URL}/api/bookings/${BOOKING_ID}" -H "$AUTH_HEADER")
  STATUS=$(echo "$STATUS_RESP" | jq -r '.status // .booking.status // empty')
  echo "  poll ${i}/${POLL_RETRIES}: status = ${STATUS}"

  if [[ "$STATUS" != "PENDING" && -n "$STATUS" ]]; then
    FINAL_STATUS="$STATUS"
    echo "$STATUS_RESP" | jq .
    break
  fi
  sleep "$POLL_SLEEP"
done

if [[ -z "$FINAL_STATUS" ]]; then
  fail "Timed out waiting for booking to leave PENDING state."
fi

if [[ "$FINAL_STATUS" == "CONFIRMED" ]]; then
  success "Booking CONFIRMED! Check Mailpit at http://localhost:8025 for the confirmation email."
else
  warn "Booking ended with status: ${FINAL_STATUS}"
fi

# ---------------------------------------------------------------------------
info "Fetching all bookings for user..."
MY_BOOKINGS=$(curl -sf "${BASE_URL}/api/bookings/my" -H "$AUTH_HEADER")
echo "$MY_BOOKINGS" | jq '[.[] | {id, status, totalAmount}]'

echo ""
echo -e "${GREEN}============================================${NC}"
echo -e "${GREEN}  Demo complete!${NC}"
echo -e "${GREEN}============================================${NC}"
echo ""
echo "  Kafka UI:    http://localhost:8080"
echo "  Mailpit:     http://localhost:8025"
echo "  Grafana:     http://localhost:3100"
echo "  Jaeger:      http://localhost:16686"
echo ""
