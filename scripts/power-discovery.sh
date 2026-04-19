#!/bin/bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_ROOT="${ROOT_DIR}/logs/power-discovery"
STATE_FILE="${LOG_ROOT}/.active-session"

DEFAULT_HOST="${POWER_DISCOVERY_HOST:-192.168.0.1}"
DEFAULT_PORT="${POWER_DISCOVERY_PORT:-2222}"
DEFAULT_USER="${POWER_DISCOVERY_USER:-root}"
DEFAULT_INTERVAL="${POWER_DISCOVERY_INTERVAL:-1}"
KNOWN_HOSTS_FILE="${HOME}/.ssh/known_hosts.d/zte"

HOST="${DEFAULT_HOST}"
PORT="${DEFAULT_PORT}"
USER_NAME="${DEFAULT_USER}"
INTERVAL="${DEFAULT_INTERVAL}"
SESSION_ID=""
LOCAL_DIR=""
REMOTE_DIR=""

SSH_BASE=()

usage() {
  cat <<'EOF'
Usage:
  scripts/power-discovery.sh start [interval_secs]
  scripts/power-discovery.sh mark "message"
  scripts/power-discovery.sh status
  scripts/power-discovery.sh stop
  scripts/power-discovery.sh help

Environment overrides:
  POWER_DISCOVERY_HOST      Router IP or hostname (default: 192.168.0.1)
  POWER_DISCOVERY_PORT      SSH port (default: 2222)
  POWER_DISCOVERY_USER      SSH user (default: root)
  POWER_DISCOVERY_INTERVAL  Snapshot interval in seconds (default: 1)

What it captures:
  - ubus listen event stream
  - logread -f stream
  - periodic snapshots of charger, type-c, powerbank, battery, and UCI state
  - local and remote manual markers

Logs are written under logs/power-discovery/<session-id>/.
EOF
}

die() {
  echo "error: $*" >&2
  exit 1
}

ensure_dirs() {
  mkdir -p "${LOG_ROOT}" "$(dirname "${KNOWN_HOSTS_FILE}")"
}

setup_ssh() {
  SSH_BASE=(
    ssh
    -p "${PORT}"
    -o StrictHostKeyChecking=accept-new
    -o UserKnownHostsFile="${KNOWN_HOSTS_FILE}"
    "${USER_NAME}@${HOST}"
  )
}

ssh_router() {
  setup_ssh
  "${SSH_BASE[@]}" "$@"
}

load_state() {
  [[ -f "${STATE_FILE}" ]] || die "no active discovery session"
  # shellcheck disable=SC1090
  source "${STATE_FILE}"
  HOST="${host}"
  PORT="${port}"
  USER_NAME="${user_name}"
  INTERVAL="${interval}"
  SESSION_ID="${session_id}"
  LOCAL_DIR="${local_dir}"
  REMOTE_DIR="${remote_dir}"
}

save_state() {
  cat > "${STATE_FILE}" <<EOF
host='${HOST}'
port='${PORT}'
user_name='${USER_NAME}'
interval='${INTERVAL}'
session_id='${SESSION_ID}'
local_dir='${LOCAL_DIR}'
remote_dir='${REMOTE_DIR}'
EOF
}

start_session() {
  ensure_dirs
  [[ ! -f "${STATE_FILE}" ]] || die "an active session already exists; run stop first"

  if [[ "${1:-}" != "" ]]; then
    INTERVAL="${1}"
  fi
  [[ "${INTERVAL}" =~ ^[0-9]+$ ]] || die "interval must be an integer number of seconds"
  (( INTERVAL > 0 )) || die "interval must be greater than zero"

  SESSION_ID="power-discovery-$(date +%Y%m%d-%H%M%S)"
  LOCAL_DIR="${LOG_ROOT}/${SESSION_ID}"
  REMOTE_DIR="/tmp/${SESSION_ID}"
  mkdir -p "${LOCAL_DIR}"

  ssh_router "sh -s -- '${REMOTE_DIR}' '${INTERVAL}'" <<'REMOTE'
set -eu
remote_dir="$1"
interval="$2"

mkdir -p "$remote_dir/samples"

cat > "$remote_dir/capture-snapshot.sh" <<'SNAP'
#!/bin/sh
set -eu
remote_dir="$1"
ts="$(date '+%Y%m%d-%H%M%S')"
out="$remote_dir/samples/$ts.txt"

capture_ubus() {
  label="$1"
  object="$2"
  method="$3"
  payload="${4:-{}}"
  echo "UBUS:$label"
  ubus call "$object" "$method" "$payload" 2>&1 || true
  echo
}

capture_cmd() {
  label="$1"
  shift
  echo "CMD:$label"
  "$@" 2>&1 || true
  echo
}

capture_file() {
  path="$1"
  echo "FILE:$path"
  if [ -r "$path" ]; then
    cat "$path" 2>&1 || true
  else
    echo "MISSING"
  fi
  echo
}

{
  echo "timestamp=$(date -Ins)"
  echo "session_dir=$remote_dir"
  echo

  capture_ubus "zwrt_bsp.battery list" zwrt_bsp.battery list '{}'
  capture_ubus "zwrt_bsp.charger list" zwrt_bsp.charger list '{}'
  capture_ubus "zwrt_bsp.charger pvlist" zwrt_bsp.charger pvlist '{}'
  capture_ubus "zwrt_bsp.typec list" zwrt_bsp.typec list '{}'
  capture_ubus "zwrt_bsp.usb list" zwrt_bsp.usb list '{}'
  capture_ubus "zwrt_bsp.powerbank get state" zwrt_bsp.powerbank get '{"property":"state"}'
  capture_ubus "zwrt_bsp.powerbank get protocol" zwrt_bsp.powerbank get '{"property":"protocol"}'

  capture_cmd "uci show zwrt_zte_mc_tmp.battery" uci show zwrt_zte_mc_tmp.battery
  capture_cmd "uci show | grep battery|charger|powerbank|typec" sh -c "uci show | grep -Ei 'battery|charger|powerbank|typec' || true"

  capture_file "/sys/class/power_supply/battery/status"
  capture_file "/sys/class/power_supply/battery/capacity"
  capture_file "/sys/class/power_supply/battery/current_now"
  capture_file "/sys/class/power_supply/battery/voltage_now"
  capture_file "/sys/class/power_supply/battery/charge_control_limit"
  capture_file "/sys/class/power_supply/battery/charge_control_limit_max"

  capture_file "/sys/class/power_supply/battery_zte/customer_mode"
  capture_file "/sys/class/power_supply/battery_zte/customer_mode_help"
  capture_file "/sys/class/power_supply/battery_zte/ui_chg_policy_mode"
  capture_file "/sys/class/power_supply/battery_zte/info"
  capture_file "/sys/class/power_supply/battery_zte/uevent"

  capture_file "/sys/class/power_supply/charger_zte/status_mbb"
  capture_file "/sys/class/power_supply/charger_zte/input_current_max_mbb"
  capture_file "/sys/class/power_supply/charger_zte/uevent"

  capture_file "/sys/class/power_supply/powerbank_zte/attached"
  capture_file "/sys/class/power_supply/powerbank_zte/force_always_on"
  capture_file "/sys/class/power_supply/powerbank_zte/online_mbb"
  capture_file "/sys/class/power_supply/powerbank_zte/present_mbb"
  capture_file "/sys/class/power_supply/powerbank_zte/protocol"
  capture_file "/sys/class/power_supply/powerbank_zte/pb_state"
  capture_file "/sys/class/power_supply/powerbank_zte/debug"
  capture_file "/sys/class/power_supply/powerbank_zte/uevent"

  capture_file "/sys/class/power_supply/type-c_zte/present_mbb"
  capture_file "/sys/class/power_supply/type-c_zte/real_type_mbb"
  capture_file "/sys/class/power_supply/type-c_zte/typec_cc_orientation_mbb"
  capture_file "/sys/class/power_supply/type-c_zte/typec_power_role_mbb"

  capture_file "/sys/class/power_supply/usb/online"
  capture_file "/sys/class/power_supply/usb/current_now"
  capture_file "/sys/class/power_supply/usb/current_max"
  capture_file "/sys/class/power_supply/usb/input_current_limit"
  capture_file "/sys/class/power_supply/usb/voltage_now"
  capture_file "/sys/class/power_supply/usb/voltage_max"
  capture_file "/sys/class/power_supply/usb/usb_type"
  capture_file "/sys/class/power_supply/usb/uevent"
} > "$out" 2>&1
SNAP
chmod +x "$remote_dir/capture-snapshot.sh"

cat > "$remote_dir/capture-loop.sh" <<'LOOP'
#!/bin/sh
set -eu
remote_dir="$1"
interval="$2"
while :; do
  "$remote_dir/capture-snapshot.sh" "$remote_dir"
  sleep "$interval"
done
LOOP
chmod +x "$remote_dir/capture-loop.sh"

printf '%s\t%s\n' "$(date -Ins)" "session started" >> "$remote_dir/markers.log"
"$remote_dir/capture-snapshot.sh" "$remote_dir"

nohup sh "$remote_dir/capture-loop.sh" "$remote_dir" "$interval" > "$remote_dir/poll.stdout.log" 2>&1 &
echo "$!" > "$remote_dir/poll.pid"

nohup ubus listen > "$remote_dir/ubus-events.log" 2>&1 &
echo "$!" > "$remote_dir/ubus.pid"

if command -v logread >/dev/null 2>&1; then
  nohup logread -f > "$remote_dir/logread.log" 2>&1 &
  echo "$!" > "$remote_dir/logread.pid"
fi
REMOTE

  save_state

  cat > "${LOCAL_DIR}/README.txt" <<EOF
Session: ${SESSION_ID}
Router: ${USER_NAME}@${HOST}:${PORT}
Snapshot interval: ${INTERVAL}s

Subcommands:
  scripts/power-discovery.sh mark "describe what you just did"
  scripts/power-discovery.sh status
  scripts/power-discovery.sh stop
EOF

  printf '%s\t%s\n' "$(date -Ins)" "session started" >> "${LOCAL_DIR}/local-markers.log"

  echo "Started ${SESSION_ID}"
  echo "Local logs: ${LOCAL_DIR}"
  echo "Remote logs: ${REMOTE_DIR}"
}

mark_session() {
  ensure_dirs
  load_state
  [[ "${1:-}" != "" ]] || die "mark requires a message"
  marker_text="$*"
  marker_line="$(date -Ins)	${marker_text}"
  printf '%s\n' "${marker_line}" >> "${LOCAL_DIR}/local-markers.log"
  printf '%s\n' "${marker_line}" | ssh_router "cat >> '${REMOTE_DIR}/markers.log'"
  echo "Marked: ${marker_text}"
}

status_session() {
  ensure_dirs
  load_state
  echo "Session: ${SESSION_ID}"
  echo "Router: ${USER_NAME}@${HOST}:${PORT}"
  echo "Local dir: ${LOCAL_DIR}"
  echo "Remote dir: ${REMOTE_DIR}"

  ssh_router "sh -s -- '${REMOTE_DIR}'" <<'REMOTE'
set -eu
remote_dir="$1"
sample_count=0
if [ -d "$remote_dir/samples" ]; then
  sample_count=$(find "$remote_dir/samples" -type f | wc -l | tr -d ' ')
fi
echo "Remote sample count: $sample_count"
for name in poll ubus logread; do
  pidfile="$remote_dir/$name.pid"
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      echo "$name: running (pid $pid)"
    else
      echo "$name: stopped"
    fi
  else
    echo "$name: not started"
  fi
done
if [ -f "$remote_dir/markers.log" ]; then
  echo "Last remote marker:"
  tail -n 1 "$remote_dir/markers.log"
fi
REMOTE
}

stop_session() {
  ensure_dirs
  load_state

  ssh_router "sh -s -- '${REMOTE_DIR}'" <<'REMOTE'
set -eu
remote_dir="$1"
if [ -x "$remote_dir/capture-snapshot.sh" ]; then
  "$remote_dir/capture-snapshot.sh" "$remote_dir" || true
fi
printf '%s\t%s\n' "$(date -Ins)" "session stopping" >> "$remote_dir/markers.log"
for name in poll ubus logread; do
  pidfile="$remote_dir/$name.pid"
  if [ -f "$pidfile" ]; then
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [ -n "$pid" ]; then
      kill "$pid" 2>/dev/null || true
    fi
  fi
done
sleep 1
REMOTE

  printf '%s\t%s\n' "$(date -Ins)" "session stopping" >> "${LOCAL_DIR}/local-markers.log"

  (
    cd "${LOG_ROOT}"
    ssh_router "tar -C /tmp -cf - '${SESSION_ID}'" | tar -xf -
  )

  ssh_router "rm -rf '${REMOTE_DIR}'"
  rm -f "${STATE_FILE}"

  echo "Stopped ${SESSION_ID}"
  echo "Captured logs: ${LOCAL_DIR}"
}

main() {
  cmd="${1:-help}"
  shift || true

  case "${cmd}" in
    start)
      start_session "${1:-}"
      ;;
    mark)
      mark_session "$@"
      ;;
    status)
      status_session
      ;;
    stop)
      stop_session
      ;;
    help|-h|--help)
      usage
      ;;
    *)
      usage
      die "unknown command: ${cmd}"
      ;;
  esac
}

main "$@"
