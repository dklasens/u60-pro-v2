#!/bin/bash
set -euo pipefail

# ============================================================================
# OpenU60 — Build & Run on iOS Device or Simulator
# ============================================================================
# Usage:
#   ./scripts/build_and_run.sh [--skip-generate] [--build-only] [--clean] [--no-logs] [--device <id>] [--simulator [name|udid]]
#
# Examples:
#   ./scripts/build_and_run.sh                          # auto-detect physical device
#   ./scripts/build_and_run.sh --clean                  # clean build
#   ./scripts/build_and_run.sh --skip-generate          # skip xcodegen step
#   ./scripts/build_and_run.sh --build-only             # build only, no install/launch
#   ./scripts/build_and_run.sh --no-logs                # launch without streaming console logs
#   ./scripts/build_and_run.sh --device 4680F0ED-...    # specific physical device
#   ./scripts/build_and_run.sh --simulator              # auto-detect simulator
#   ./scripts/build_and_run.sh --simulator "iPhone 16 Pro" # specific simulator by name
# ============================================================================

# --- Resolve project root from script location ------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../OpenU60" && pwd)"
cd "$PROJECT_ROOT"

# --- Load .env if present ----------------------------------------------------
ENV_FILE="$PROJECT_ROOT/.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# --- Constants ---------------------------------------------------------------
SCHEME="OpenU60"
XCODEPROJ="OpenU60.xcodeproj"
BUNDLE_ID="com.openu60.app"
TEAM_ID="${TEAM_ID:-}"

# --- Colors ------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

# --- Timing ------------------------------------------------------------------
START_MS=$(python3 -c "import time; print(int(time.time() * 1000))")
STEP_START_S=0
STEP_START_MS=$START_MS
TIMER_PID=""

elapsed_ms() {
  local now_ms
  now_ms=$(python3 -c "import time; print(int(time.time() * 1000))")
  echo $(( now_ms - START_MS ))
}

format_elapsed() {
  local ms
  ms=$(elapsed_ms)
  if [[ $ms -lt 1000 ]]; then
    echo "${ms}ms"
  else
    python3 -c "print(f'{$ms / 1000:.1f}s')"
  fi
}

format_seconds() {
  local s=$1
  if [[ $s -lt 60 ]]; then
    echo "${s}s"
  else
    echo "$((s / 60))m$((s % 60))s"
  fi
}

cleanup_timer() {
  if [[ -n "${TIMER_PID:-}" ]] && kill -0 "$TIMER_PID" 2>/dev/null; then
    kill "$TIMER_PID" 2>/dev/null || true
    wait "$TIMER_PID" 2>/dev/null || true
  fi
  TIMER_PID=""
}
trap cleanup_timer EXIT

# --- Helpers -----------------------------------------------------------------
step() {
  STEP_START_S=$(date +%s)
  STEP_START_MS=$(python3 -c "import time; print(int(time.time() * 1000))")
  echo ""
  echo -e "${BLUE}${BOLD}▶ Step $1:${NC} ${CYAN}$2${NC}"
  echo -e "${BLUE}──────────────────────────────────────────${NC}"
}

success() {
  echo -e "  ${GREEN}✔ $1${NC}"
}

info() {
  echo -e "  ${YELLOW}ℹ $1${NC}"
}

fail() {
  echo -e "  ${RED}✖ $1${NC}" >&2
  exit 1
}

start_timer() {
  local label="$1"
  local start_ms=$STEP_START_MS
  (
    while true; do
      local now_ms=$(python3 -c "import time; print(int(time.time() * 1000))")
      local elapsed_ms=$((now_ms - start_ms))
      if [[ $elapsed_ms -lt 1000 ]]; then
        printf "\r  ⏱ %s [+%sms]  " "$label" "$elapsed_ms"
      else
        local formatted=$(python3 -c "print(f'{$elapsed_ms / 1000:.1f}s')")
        printf "\r  ⏱ %s [+%s]  " "$label" "$formatted"
      fi
      sleep 0.1
    done
  ) &
  TIMER_PID=$!
}

stop_timer() {
  local message="$1"
  cleanup_timer
  local end_s=$(date +%s)
  local elapsed=$((end_s - STEP_START_S))
  printf "\r\033[K"
  echo -e "  ${GREEN}✔ ${message}${NC}  ${YELLOW}[$(format_seconds $elapsed)]${NC}"
}

run_timed() {
  local timer_label="$1"
  local success_msg="$2"
  shift 2

  local tmp_out
  tmp_out=$(mktemp)

  start_timer "$timer_label"
  local exit_code=0
  "$@" > "$tmp_out" 2>&1 || exit_code=$?
  cleanup_timer

  local end_s=$(date +%s)
  local elapsed=$((end_s - STEP_START_S))
  printf "\r\033[K"

  if [[ $exit_code -eq 0 ]]; then
    echo -e "  ${GREEN}✔ ${success_msg}${NC}  ${YELLOW}[$(format_seconds $elapsed)]${NC}"
  else
    echo -e "  ${RED}✖ Failed${NC}  ${YELLOW}[$(format_seconds $elapsed)]${NC}"
    echo ""
    echo -e "  ${RED}Last 30 lines of output:${NC}"
    tail -30 "$tmp_out" | sed 's/^/    /'
    rm -f "$tmp_out"
    exit 1
  fi
  rm -f "$tmp_out"
}

run_timed_with_output() {
  local timer_label="$1"
  local success_msg="$2"
  local tail_lines="$3"
  shift 3

  local tmp_out
  tmp_out=$(mktemp)

  start_timer "$timer_label"
  local exit_code=0
  "$@" > "$tmp_out" 2>&1 || exit_code=$?
  cleanup_timer

  local end_s=$(date +%s)
  local elapsed=$((end_s - STEP_START_S))
  printf "\r\033[K"

  if [[ $exit_code -eq 0 ]]; then
    echo -e "  ${GREEN}✔ ${success_msg}${NC}  ${YELLOW}[$(format_seconds $elapsed)]${NC}"
    if [[ $tail_lines -gt 0 ]]; then
      tail -"$tail_lines" "$tmp_out" | sed 's/^/    /'
    fi
  else
    echo -e "  ${RED}✖ Failed${NC}  ${YELLOW}[$(format_seconds $elapsed)]${NC}"
    echo ""
    echo -e "  ${RED}Last 30 lines of output:${NC}"
    tail -30 "$tmp_out" | sed 's/^/    /'
    rm -f "$tmp_out"
    exit 1
  fi
  rm -f "$tmp_out"
}

# --- Device detection --------------------------------------------------------
detect_devices() {
  local json_file="/tmp/ztec_devices.json"

  if ! xcrun devicectl list devices --json-output "$json_file" > /dev/null 2>&1; then
    fail "Failed to list devices. Is Xcode installed and configured?"
  fi

  python3 -c "
import json, sys
with open('$json_file') as f:
    data = json.load(f)
devices = []
for d in data.get('result', {}).get('devices', []):
    tunnel = d.get('connectionProperties', {}).get('tunnelState', '')
    transport = d.get('connectionProperties', {}).get('transportType', '')
    name = d.get('deviceProperties', {}).get('name', 'Unknown')
    model = d.get('hardwareProperties', {}).get('marketingName', '')
    identifier = d.get('identifier', '')
    if 'iPhone' in model and tunnel == 'connected' and identifier and transport.lower() not in ('', 'wifi'):
        tag = 'wifi' if transport == '' or transport.lower() == 'wifi' else transport.lower()
        devices.append(f'{identifier}\t{name}\t{model}\t{tag}')
for d in devices:
    print(d)
" 2>/dev/null
}

select_device() {
  if [[ -n "${DEVICE_ID:-}" ]]; then
    DEVICE_NAME="(manually specified)"
    return
  fi

  info "Detecting connected iPhones..."
  echo ""

  local devices_raw
  devices_raw=$(detect_devices)

  if [[ -z "$devices_raw" ]]; then
    fail "No connected iPhone found. Connect a device and try again."
  fi

  local -a identifiers=()
  local -a names=()
  local -a models=()
  local -a transports=()

  while IFS= read -r line; do
    IFS=$'\t' read -r id name model transport <<< "$line"
    identifiers+=("$id")
    names+=("$name")
    models+=("$model")
    transports+=("$transport")
  done <<< "$devices_raw"

  local count=${#identifiers[@]}

  if [[ $count -eq 1 ]]; then
    DEVICE_ID="${identifiers[0]}"
    DEVICE_NAME="${names[0]}"
    success "Auto-selected: ${names[0]}  •  ${models[0]} (${transports[0]})"
  else
    echo -e "  ${BOLD}Found $count connected iPhones:${NC}"
    for i in $(seq 0 $((count - 1))); do
      local num=$((i + 1))
      echo -e "    ${BOLD}[$num]${NC} ${names[$i]}  •  ${models[$i]} (${transports[$i]})"
    done
    echo ""
    printf "  Select device [1] (q to quit): "
    read -n 1 selection
    echo ""
    if [[ "$selection" == "q" || "$selection" == "Q" ]]; then
      echo ""
      echo -e "  ${YELLOW}Aborted.${NC}"
      exit 0
    fi
    selection=${selection:-1}

    if ! [[ "$selection" =~ ^[0-9]+$ ]] || [[ $selection -lt 1 ]] || [[ $selection -gt $count ]]; then
      fail "Invalid selection: $selection"
    fi

    local idx=$((selection - 1))
    DEVICE_ID="${identifiers[$idx]}"
    DEVICE_NAME="${names[$idx]}"
    success "Selected: ${names[$idx]}  •  ${models[$idx]} (${transports[$idx]})"
  fi
}

# --- Simulator detection ----------------------------------------------------
detect_simulators() {
  xcrun simctl list devices available -j 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
devices = data.get('devices', {})
for runtime, devs in devices.items():
    rt = runtime.rsplit('.', 1)[-1].replace('-', ' ').replace('SimRuntime ', '')
    for d in devs:
        name = d.get('name', '')
        udid = d.get('udid', '')
        state = d.get('state', '')
        if 'iPhone' in name and udid:
            print(f'{udid}\t{name}\t{state}\t{rt}')
" 2>/dev/null
}

select_simulator() {
  if [[ -n "$SIMULATOR_ARG" ]]; then
    if [[ "$SIMULATOR_ARG" =~ ^[0-9A-Fa-f]{8}-([0-9A-Fa-f]{4}-){3}[0-9A-Fa-f]{12}$ ]]; then
      DEVICE_ID="$SIMULATOR_ARG"
      DEVICE_NAME="(simulator UDID)"
      return
    fi
  fi

  info "Detecting available iPhone simulators..."
  echo ""

  local sims_raw
  sims_raw=$(detect_simulators)

  if [[ -z "$sims_raw" ]]; then
    fail "No available iPhone simulators found. Create one in Xcode > Settings > Platforms."
  fi

  local -a identifiers=()
  local -a names=()
  local -a states=()
  local -a runtimes=()

  while IFS= read -r line; do
    IFS=$'\t' read -r id name state rt <<< "$line"
    identifiers+=("$id")
    names+=("$name")
    states+=("$state")
    runtimes+=("$rt")
  done <<< "$sims_raw"

  local count=${#identifiers[@]}

  # If SIMULATOR_ARG is a name, match it
  if [[ -n "$SIMULATOR_ARG" ]]; then
    for i in $(seq 0 $((count - 1))); do
      if [[ "${names[$i]}" == "$SIMULATOR_ARG" ]]; then
        DEVICE_ID="${identifiers[$i]}"
        DEVICE_NAME="${names[$i]}"
        success "Matched simulator: ${names[$i]}  •  ${identifiers[$i]}  •  ${runtimes[$i]}"
        return
      fi
    done
    fail "No simulator found matching name '$SIMULATOR_ARG'. Available: $(printf '%s, ' "${names[@]}" | sed 's/, $//')"
  fi

  # Auto-select: prefer booted simulator
  for i in $(seq 0 $((count - 1))); do
    if [[ "${states[$i]}" == "Booted" ]]; then
      DEVICE_ID="${identifiers[$i]}"
      DEVICE_NAME="${names[$i]}"
      success "Auto-selected (booted): ${names[$i]}  •  ${identifiers[$i]}  •  ${runtimes[$i]}"
      return
    fi
  done

  # Single simulator? Auto-select
  if [[ $count -eq 1 ]]; then
    DEVICE_ID="${identifiers[0]}"
    DEVICE_NAME="${names[0]}"
    success "Auto-selected: ${names[0]}  •  ${identifiers[0]}  •  ${runtimes[0]}"
    return
  fi

  # Multiple — interactive menu
  echo -e "  ${BOLD}Found $count iPhone simulators:${NC}"
  for i in $(seq 0 $((count - 1))); do
    local num=$((i + 1))
    local state_tag=""
    if [[ "${states[$i]}" == "Booted" ]]; then
      state_tag="  ${GREEN}(booted)${NC}"
    fi
    echo -e "    ${BOLD}[$num]${NC} ${names[$i]}  •  ${runtimes[$i]}${state_tag}"
  done
  echo ""
  printf "  Select simulator [1] (q to quit): "
  read -n 1 selection
  echo ""
  if [[ "$selection" == "q" || "$selection" == "Q" ]]; then
    echo ""
    echo -e "  ${YELLOW}Aborted.${NC}"
    exit 0
  fi
  selection=${selection:-1}

  if ! [[ "$selection" =~ ^[0-9]+$ ]] || [[ $selection -lt 1 ]] || [[ $selection -gt $count ]]; then
    fail "Invalid selection: $selection"
  fi

  local idx=$((selection - 1))
  DEVICE_ID="${identifiers[$idx]}"
  DEVICE_NAME="${names[$idx]}"
  success "Selected: ${names[$idx]}  •  ${identifiers[$idx]}  •  ${runtimes[$idx]}"
}

# --- Defaults ----------------------------------------------------------------
SKIP_GENERATE=false
BUILD_ONLY=false
CLEAN_BUILD=false
DEVICE_ID=""
DEVICE_NAME=""
NO_LOGS=false
USE_SIMULATOR=false
SIMULATOR_ARG=""

# --- Parse arguments ---------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --device)
      DEVICE_ID="$2"
      shift 2
      ;;
    --skip-generate)
      SKIP_GENERATE=true
      shift
      ;;
    --build-only)
      BUILD_ONLY=true
      shift
      ;;
    --clean)
      CLEAN_BUILD=true
      shift
      ;;
    --no-logs)
      NO_LOGS=true
      shift
      ;;
    --simulator)
      USE_SIMULATOR=true
      shift
      # Consume optional next arg as simulator name/UDID (if not another flag)
      if [[ $# -gt 0 ]] && [[ "$1" != --* ]]; then
        SIMULATOR_ARG="$1"
        shift
      fi
      ;;
    -h|--help)
      echo "Usage: $0 [--skip-generate] [--build-only] [--clean] [--no-logs] [--device <id>] [--simulator [name|udid]]"
      echo ""
      echo "Options:"
      echo "  --device <id>          Physical device ID to install on (skips auto-detection)"
      echo "  --simulator [name|id]  Target iOS Simulator (auto-detect, or specify name/UDID)"
      echo "  --skip-generate        Skip xcodegen project generation"
      echo "  --build-only           Build only, do not install or launch"
      echo "  --clean                Clean build directory before building"
      echo "  --no-logs              Launch app without streaming console logs"
      echo "  -h, --help             Show this help message"
      exit 0
      ;;
    *)
      fail "Unknown option: $1. Use --help for usage."
      ;;
  esac
done

# --- Mutual exclusion check --------------------------------------------------
if $USE_SIMULATOR && [[ -n "$DEVICE_ID" ]]; then
  fail "Cannot use --simulator and --device together. Pick one target."
fi

# --- Tool checks -------------------------------------------------------------
if ! $SKIP_GENERATE; then
  if ! command -v xcodegen &>/dev/null; then
    fail "xcodegen not found. Install with: brew install xcodegen"
  fi
fi

# --- Team ID check (required for physical device builds) --------------------
if ! $USE_SIMULATOR && [[ -z "$TEAM_ID" ]]; then
  fail "TEAM_ID not set. Export it or add to OpenU60/.env (see .env.example)"
fi

# --- Device / simulator selection (before build) ----------------------------
if ! $BUILD_ONLY; then
  if $USE_SIMULATOR; then
    select_simulator
  else
    select_device
  fi
fi

# --- Header ------------------------------------------------------------------
echo ""
echo -e "${BOLD}${CYAN}╔══════════════════════════════════════════╗${NC}"
if $USE_SIMULATOR; then
echo -e "${BOLD}${CYAN}║    OpenU60 — Build & Run (Sim)            ║${NC}"
else
echo -e "${BOLD}${CYAN}║    OpenU60 — Build & Run                 ║${NC}"
fi
echo -e "${BOLD}${CYAN}╚══════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${BOLD}Scheme:${NC}       $SCHEME"
if ! $BUILD_ONLY; then
  echo -e "  ${BOLD}Device:${NC}       $DEVICE_NAME ($DEVICE_ID)"
fi
echo -e "  ${BOLD}Bundle ID:${NC}    $BUNDLE_ID"
if $SKIP_GENERATE; then
  echo -e "  ${YELLOW}Skipping xcodegen${NC}"
fi
if $BUILD_ONLY; then
  echo -e "  ${YELLOW}Build only (no install/launch)${NC}"
fi
if $CLEAN_BUILD; then
  echo -e "  ${YELLOW}Clean build${NC}"
fi
if $NO_LOGS; then
  echo -e "  ${YELLOW}No log streaming${NC}"
fi

# --- Step 1: Generate Xcode project -----------------------------------------
STEP_NUM=1
if $SKIP_GENERATE; then
  step $STEP_NUM "Skipping Xcode project generation (--skip-generate)"
  info "Using existing $XCODEPROJ"
else
  step $STEP_NUM "Generating Xcode project with xcodegen"
  run_timed "Generating..." "Xcode project generated" xcodegen generate
fi

# --- Step 2: Clean (optional) -----------------------------------------------
BUILD_DIR="build"

if $CLEAN_BUILD; then
  STEP_NUM=$((STEP_NUM + 1))
  step $STEP_NUM "Cleaning build directory"
  rm -rf "$BUILD_DIR"
  success "Build directory cleaned"
fi

# --- Step 3: Build -----------------------------------------------------------
STEP_NUM=$((STEP_NUM + 1))
step $STEP_NUM "Building scheme '$SCHEME'"

if $USE_SIMULATOR; then
  run_timed_with_output "Building..." "Build succeeded" 5 \
    xcodebuild \
    -project "$XCODEPROJ" \
    -scheme "$SCHEME" \
    -destination "platform=iOS Simulator,id=$DEVICE_ID" \
    -derivedDataPath "$BUILD_DIR" \
    build
else
  run_timed_with_output "Building..." "Build succeeded" 5 \
    xcodebuild \
    -project "$XCODEPROJ" \
    -scheme "$SCHEME" \
    -destination "generic/platform=iOS" \
    -derivedDataPath "$BUILD_DIR" \
    -allowProvisioningUpdates \
    DEVELOPMENT_TEAM="$TEAM_ID" \
    build
fi

# --- Locate the .app ---------------------------------------------------------
if $USE_SIMULATOR; then
  APP_PATH=$(find "$BUILD_DIR" -name "*.app" -not -path "*.dSYM/*" -path "*/Debug-iphonesimulator/*" | head -1)
  if [[ -z "$APP_PATH" ]]; then
    APP_PATH=$(find "$BUILD_DIR" -name "*.app" -not -path "*.dSYM/*" -path "*/Release-iphonesimulator/*" | head -1)
  fi
else
  APP_PATH=$(find "$BUILD_DIR" -name "*.app" -not -path "*.dSYM/*" -path "*/Debug-iphoneos/*" | head -1)
  if [[ -z "$APP_PATH" ]]; then
    APP_PATH=$(find "$BUILD_DIR" -name "*.app" -not -path "*.dSYM/*" -path "*/Release-iphoneos/*" | head -1)
  fi
fi
if [[ -z "$APP_PATH" ]]; then
  fail "Could not locate .app bundle in $BUILD_DIR"
fi
info "App bundle: $APP_PATH"

# --- Step N: Install on device -----------------------------------------------
if $BUILD_ONLY; then
  echo ""
  echo -e "${GREEN}${BOLD}✔ Build complete (--build-only). Skipping install and launch.${NC}"
  echo -e "  ${YELLOW}Total: $(format_elapsed)${NC}"
  exit 0
fi

STEP_NUM=$((STEP_NUM + 1))
if $USE_SIMULATOR; then
  step $STEP_NUM "Installing app on simulator ($DEVICE_NAME)"

  # Boot simulator if not already booted
  SIM_STATE=$(xcrun simctl list devices -j 2>/dev/null | python3 -c "
import json, sys
data = json.load(sys.stdin)
for runtime, devs in data.get('devices', {}).items():
    for d in devs:
        if d.get('udid') == '$DEVICE_ID':
            print(d.get('state', 'Unknown'))
            sys.exit(0)
print('Unknown')
" 2>/dev/null)

  if [[ "$SIM_STATE" != "Booted" ]]; then
    info "Booting simulator..."
    xcrun simctl boot "$DEVICE_ID" 2>/dev/null || true
    open -a Simulator
    sleep 2
  fi

  run_timed "Installing..." "App installed" \
    xcrun simctl install "$DEVICE_ID" "$APP_PATH"
else
  step $STEP_NUM "Installing app on device ($DEVICE_NAME)"

  run_timed "Installing..." "App installed" \
    xcrun devicectl device install app --device "$DEVICE_ID" "$APP_PATH"
fi

# --- Step N+1: Launch on device ----------------------------------------------
STEP_NUM=$((STEP_NUM + 1))
TARGET_LABEL=$($USE_SIMULATOR && echo "simulator" || echo "device")

if $NO_LOGS; then
  step $STEP_NUM "Launching app on $TARGET_LABEL"

  if $USE_SIMULATOR; then
    run_timed "Launching..." "App launched" \
      xcrun simctl launch "$DEVICE_ID" "$BUNDLE_ID"
  else
    run_timed "Launching..." "App launched" \
      xcrun devicectl device process launch --device "$DEVICE_ID" "$BUNDLE_ID"
  fi

  # --- Done ------------------------------------------------------------------
  echo ""
  echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}${BOLD}║     ✔ Build & Run Complete!              ║${NC}"
  echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
  echo -e "  ${YELLOW}Total: $(format_elapsed)${NC}"
  echo ""
else
  step $STEP_NUM "Launching app on $TARGET_LABEL (streaming logs — press q or Ctrl+C to stop)"

  # Save terminal settings and restore on exit
  ORIG_STTY=$(stty -g)
  cleanup() {
    cleanup_timer
    stty "$ORIG_STTY" 2>/dev/null
    if [[ -n "${LAUNCH_PID:-}" ]] && kill -0 "$LAUNCH_PID" 2>/dev/null; then
      kill "$LAUNCH_PID" 2>/dev/null
      wait "$LAUNCH_PID" 2>/dev/null
    fi
    echo ""
    echo -e "  ${YELLOW}ℹ Log streaming stopped.${NC}"
    echo ""
    echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}${BOLD}║     ✔ Build & Run Complete!              ║${NC}"
    echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════╝${NC}"
    echo -e "  ${YELLOW}Total: $(format_elapsed)${NC}"
    echo ""
  }
  trap cleanup EXIT

  info "Streaming logs at +$(format_elapsed)"

  if $USE_SIMULATOR; then
    xcrun simctl terminate "$DEVICE_ID" "$BUNDLE_ID" 2>/dev/null || true
    xcrun simctl launch --console-pty "$DEVICE_ID" "$BUNDLE_ID" &
    LAUNCH_PID=$!
  else
    xcrun devicectl device process launch \
      --device "$DEVICE_ID" \
      --console \
      --terminate-existing \
      "$BUNDLE_ID" &
    LAUNCH_PID=$!
  fi

  # Monitor for 'q' keypress
  while kill -0 "$LAUNCH_PID" 2>/dev/null; do
    if read -rsn1 -t1 key 2>/dev/null; then
      if [[ "$key" == "q" || "$key" == "Q" ]]; then
        exit 0  # cleanup trap handles the rest
      fi
    fi
  done
fi
