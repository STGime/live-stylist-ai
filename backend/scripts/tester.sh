#!/usr/bin/env bash
# Manage the LiveStylist beta-tester allowlist.
#
# Usage:
#   tester.sh list
#   tester.sh add <device-id>
#   tester.sh remove <device-id>
#
# Tester devices bypass the 1-session lifetime trial and get
# TESTER_MONTHLY_SESSION_CAP (default 100) sessions/month. The allowlist
# is stored in the Cloud Run env var TESTER_DEVICE_IDS (comma-separated).
#
# Reinstalls give the tester a NEW device id, so they'd need to resend
# theirs (visible in Profile screen, long-press to copy on iOS).
set -euo pipefail

PROJECT_ID="livestylist-8f221"
REGION="us-central1"
SERVICE="livestylist-backend"
ENV_NAME="TESTER_DEVICE_IDS"

cmd="${1:-}"
arg="${2:-}"

get_current() {
  # Cloud Run returns env vars as a YAML-ish list; extract this one and
  # strip surrounding quotes / whitespace. Empty string is fine.
  gcloud run services describe "$SERVICE" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --format="value(spec.template.spec.containers[0].env)" 2>/dev/null \
    | tr ';' '\n' \
    | awk -F"'value': '" "/'name': '$ENV_NAME'/ {print \$2}" \
    | sed -E "s/'[}].*$//" \
    | head -1
}

set_value() {
  local new="$1"
  echo "Updating $ENV_NAME on $SERVICE..."
  if [[ -z "$new" ]]; then
    # Cloud Run doesn't allow setting an empty value via --update-env-vars,
    # so use the form that explicitly sets it.
    gcloud run services update "$SERVICE" \
      --project "$PROJECT_ID" \
      --region "$REGION" \
      --update-env-vars="${ENV_NAME}=" \
      --quiet
  else
    gcloud run services update "$SERVICE" \
      --project "$PROJECT_ID" \
      --region "$REGION" \
      --update-env-vars="${ENV_NAME}=${new}" \
      --quiet
  fi
}

case "$cmd" in
  list)
    current=$(get_current)
    if [[ -z "$current" ]]; then
      echo "(no tester devices)"
    else
      echo "$current" | tr ',' '\n' | nl
    fi
    ;;

  add)
    [[ -z "$arg" ]] && { echo "Usage: tester.sh add <device-id>" >&2; exit 2; }
    current=$(get_current)
    if echo ",${current}," | grep -q ",${arg},"; then
      echo "Device id already on the allowlist: $arg"
      exit 0
    fi
    if [[ -z "$current" ]]; then
      new="$arg"
    else
      new="${current},${arg}"
    fi
    set_value "$new"
    echo "Added. Current list:"
    "$0" list
    ;;

  remove)
    [[ -z "$arg" ]] && { echo "Usage: tester.sh remove <device-id>" >&2; exit 2; }
    current=$(get_current)
    if ! echo ",${current}," | grep -q ",${arg},"; then
      echo "Device id not on the allowlist: $arg"
      exit 0
    fi
    new=$(echo "$current" | tr ',' '\n' | grep -vx "$arg" | paste -sd ',' -)
    set_value "$new"
    echo "Removed. Current list:"
    "$0" list
    ;;

  *)
    cat >&2 <<EOF
LiveStylist tester allowlist manager.

Usage:
  $0 list                      List current testers
  $0 add    <device-id>        Add a device to the tester allowlist
  $0 remove <device-id>        Remove a device from the tester allowlist

Each tester gets ${TESTER_MONTHLY_SESSION_CAP:-100} sessions/month and skips
the lifetime trial gate. Cloud Run hot-swaps env vars without a rebuild.
EOF
    exit 2
    ;;
esac
