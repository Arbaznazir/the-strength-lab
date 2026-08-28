#!/usr/bin/env bash
# The Strength Lab — kill stale ports, ensure Postgres, launch API + Web in two terminals.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

API_PORT=8080
WEB_PORT=3000
API_DIR="$ROOT/api"
WEB_DIR="$ROOT/web"
ENV_FILE="$API_DIR/.env"
PGDATA_DIR="$ROOT/.pgdata"
LOCAL_PG_PORT=5433
LOG_DIR="$ROOT/.logs"
mkdir -p "$LOG_DIR"

# Resolve the user's default terminal (not hard-coded to GNOME).
# Order: $TERMINAL → xdg-terminal-exec → x-terminal-emulator → common fallbacks.
detect_terminal() {
  if [[ -n "${TERMINAL:-}" ]] && command -v "$TERMINAL" >/dev/null 2>&1; then
    TERM_BIN="$TERMINAL"
    TERM_KIND="custom"
    return
  fi
  if [[ "$(uname -s)" == "Darwin" ]]; then
    if [[ -d "/Applications/iTerm.app" ]]; then
      TERM_BIN="open"
      TERM_KIND="macos-iterm"
      return
    fi
    if [[ -d "/System/Applications/Utilities/Terminal.app" ]] \
      || [[ -d "/Applications/Utilities/Terminal.app" ]]; then
      TERM_BIN="open"
      TERM_KIND="macos-terminal"
      return
    fi
  fi
  if command -v xdg-terminal-exec >/dev/null 2>&1; then
    TERM_BIN="xdg-terminal-exec"
    TERM_KIND="xdg"
    return
  fi
  if command -v x-terminal-emulator >/dev/null 2>&1; then
    TERM_BIN="x-terminal-emulator"
    # Resolve what alternatives points at (for nicer logging / flags)
    local resolved
    resolved="$(readlink -f "$(command -v x-terminal-emulator)" 2>/dev/null || true)"
    TERM_KIND="default"
    case "$resolved" in
      *gnome-terminal*) TERM_KIND="gnome" ;;
      *konsole*) TERM_KIND="konsole" ;;
      *xfce4-terminal*) TERM_KIND="xfce" ;;
      *mate-terminal*) TERM_KIND="mate" ;;
      *tilix*) TERM_KIND="tilix" ;;
      *alacritty*) TERM_KIND="alacritty" ;;
      *kitty*) TERM_KIND="kitty" ;;
      *wezterm*) TERM_KIND="wezterm" ;;
    esac
    return
  fi
  for cand in kgx konsole xfce4-terminal mate-terminal tilix alacritty kitty wezterm gnome-terminal; do
    if command -v "$cand" >/dev/null 2>&1; then
      TERM_BIN="$cand"
      TERM_KIND="$cand"
      return
    fi
  done
  TERM_BIN=""
  TERM_KIND=""
}

TERM_BIN=""
TERM_KIND=""
detect_terminal

c_info()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
c_ok()    { printf '\033[1;32m✔\033[0m %s\n' "$*"; }
c_warn()  { printf '\033[1;33m!\033[0m %s\n' "$*"; }
c_err()   { printf '\033[1;31m✖\033[0m %s\n' "$*"; }

log_slug() {
  echo "$1" | tr ' :/' '___'
}

ensure_env_files() {
  local pair dest example dir
  for pair in \
    "$ROOT/.env:$ROOT/.env.example" \
    "$API_DIR/.env:$API_DIR/.env.example" \
    "$WEB_DIR/.env:$WEB_DIR/.env.example"; do
    dest="${pair%%:*}"
    example="${pair#*:}"
    if [[ -f "$dest" ]]; then
      continue
    fi
    if [[ ! -f "$example" ]]; then
      continue
    fi
    cp "$example" "$dest"
    if [[ "$dest" == "$API_DIR/.env" ]]; then
      # api/.env.example targets Docker; native ./start.sh uses local ports.
      sed -i '' \
        -e 's|@host.docker.internal:5432|@127.0.0.1:5433|g' \
        -e 's|@postgres:5432|@127.0.0.1:5433|g' \
        -e 's|redis://redis:6379|redis://127.0.0.1:6379|g' \
        "$dest" 2>/dev/null \
        || sed -i \
          -e 's|@host.docker.internal:5432|@127.0.0.1:5433|g' \
          -e 's|@postgres:5432|@127.0.0.1:5433|g' \
          -e 's|redis://redis:6379|redis://127.0.0.1:6379|g' \
          "$dest"
    fi
    dir="$(basename "$(dirname "$dest")")"
    if [[ "$dir" == "$(basename "$ROOT")" ]]; then
      c_ok "Created .env from .env.example"
    else
      c_ok "Created $dir/.env from .env.example"
    fi
  done
}

read_env_file() {
  local file="$1"
  [[ -f "$file" ]] || return 0
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
      export "$line"
    fi
  done < "$file"
}

# ./start.sh runs on the host — rewrite docker-only URLs from .env.example copies.
apply_native_env() {
  if [[ -f /.dockerenv ]]; then
    return 0
  fi
  case "${DATABASE_URL:-}" in
    *@host.docker.internal:*|*@postgres:*|*@postgres/*)
      DATABASE_URL="postgres://strengthlab:strengthlab@127.0.0.1:5433/strengthlab?sslmode=disable"
      ;;
  esac
  case "${REDIS_URL:-}" in
    redis://redis:*|redis://redis/*)
      REDIS_URL="redis://127.0.0.1:6379/0"
      ;;
  esac
}

load_env() {
  read_env_file "$ROOT/.env"
  read_env_file "$ENV_FILE"
  read_env_file "$WEB_DIR/.env"
  DATABASE_URL="${DATABASE_URL:-postgres://strengthlab:strengthlab@127.0.0.1:5433/strengthlab?sslmode=disable}"
  API_ADDR="${API_ADDR:-:$API_PORT}"
  JWT_SECRET="${JWT_SECRET:-change-me-in-production-use-long-random-string}"
  CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:3000}"
  SEED_ON_BOOT="${SEED_ON_BOOT:-true}"
  REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379/0}"
  NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8080}"
  NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_WS_URL:-ws://localhost:8080}"
  apply_native_env
}

# Parse postgres://user:pass@host:port/db
parse_database_url() {
  local url="$1"
  DB_USER="$(printf '%s' "$url" | sed -E 's|^postgres(ql)?://([^:/]+).*|\2|')"
  DB_PASS="$(printf '%s' "$url" | sed -E 's|^postgres(ql)?://[^:]+:([^@]+)@.*|\2|')"
  DB_HOST="$(printf '%s' "$url" | sed -E 's|^postgres(ql)?://[^@]+@([^:/]+).*|\2|')"
  DB_PORT="$(printf '%s' "$url" | sed -E 's|^postgres(ql)?://[^@]+@[^:/]+:([0-9]+).*|\2|')"
  DB_NAME="$(printf '%s' "$url" | sed -E 's|^postgres(ql)?://[^/]+/([^?]+).*|\2|')"
  DB_HOST="${DB_HOST:-127.0.0.1}"
  DB_PORT="${DB_PORT:-5432}"
  DB_USER="${DB_USER:-strengthlab}"
  DB_PASS="${DB_PASS:-strengthlab}"
  DB_NAME="${DB_NAME:-strengthlab}"
}

kill_port() {
  local port="$1"
  local pids=""

  # macOS / BSD
  if command -v lsof >/dev/null 2>&1; then
    pids="$(lsof -ti "tcp:${port}" -sTCP:LISTEN 2>/dev/null | sort -u || true)"
  fi
  # Linux (portable sed — BSD grep has no -P)
  if [[ -z "$pids" ]] && command -v ss >/dev/null 2>&1; then
    pids="$(
      ss -ltnp 2>/dev/null \
        | awk -v p=":$port" '$4 ~ p"$" {print}' \
        | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' \
        | sort -u || true
    )"
  fi
  if [[ -z "$pids" ]] && command -v fuser >/dev/null 2>&1; then
    pids="$(fuser "${port}/tcp" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' | sort -u || true)"
  fi
  if [[ -z "$pids" ]]; then
    c_ok "Port $port is free"
    return 0
  fi
  c_warn "Port $port in use by: $pids — killing"
  # shellcheck disable=SC2086
  kill $pids 2>/dev/null || true
  sleep 0.6
  # shellcheck disable=SC2086
  kill -9 $pids 2>/dev/null || true
  sleep 0.3
  c_ok "Port $port cleared"
}

db_ready() {
  local host="$1" port="$2" user="$3" db="$4" pass="$5"
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1 || return 1
  fi
  PGPASSWORD="$pass" psql -h "$host" -p "$port" -U "$user" -d "$db" -c 'SELECT 1' >/dev/null 2>&1
}

ensure_local_pg() {
  # User-space Postgres under .pgdata (no sudo / docker required)
  local bindir
  bindir="$(dirname "$(command -v initdb 2>/dev/null || true)")"
  if [[ -z "$bindir" || ! -x "$bindir/pg_ctl" ]]; then
    # common paths
    for d in /usr/lib/postgresql/*/bin /usr/pgsql-*/bin; do
      if [[ -x "$d/pg_ctl" ]]; then
        bindir="$d"
        break
      fi
    done
  fi
  if [[ -z "${bindir:-}" || ! -x "$bindir/pg_ctl" ]]; then
    c_err "No local pg_ctl/initdb found"
    return 1
  fi

  if [[ ! -d "$PGDATA_DIR" ]]; then
    c_info "Initializing local Postgres in $PGDATA_DIR"
    "$bindir/initdb" -D "$PGDATA_DIR" --auth=trust --username="$DB_USER" >/dev/null
    {
      echo "listen_addresses = '127.0.0.1'"
      echo "port = $LOCAL_PG_PORT"
    } >> "$PGDATA_DIR/postgresql.conf"
  fi

  if ! "$bindir/pg_ctl" -D "$PGDATA_DIR" status >/dev/null 2>&1; then
    c_info "Starting local Postgres on 127.0.0.1:$LOCAL_PG_PORT"
    "$bindir/pg_ctl" -D "$PGDATA_DIR" -l "$LOG_DIR/postgres.log" -o "-p $LOCAL_PG_PORT -h 127.0.0.1" start >/dev/null
    sleep 1
  else
    c_ok "Local Postgres already running"
  fi

  # Ensure database exists
  if ! PGPASSWORD="$DB_PASS" psql -h 127.0.0.1 -p "$LOCAL_PG_PORT" -U "$DB_USER" -d postgres -tc \
      "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" 2>/dev/null | grep -q 1; then
    PGPASSWORD="$DB_PASS" createdb -h 127.0.0.1 -p "$LOCAL_PG_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null \
      || "$bindir/createdb" -h 127.0.0.1 -p "$LOCAL_PG_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null \
      || true
  fi

  DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@127.0.0.1:${LOCAL_PG_PORT}/${DB_NAME}?sslmode=disable"
  export DATABASE_URL
  c_ok "Using local Postgres → $DATABASE_URL"
}

ensure_db() {
  parse_database_url "$DATABASE_URL"
  c_info "Checking database ${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}"

  if db_ready "$DB_HOST" "$DB_PORT" "$DB_USER" "$DB_NAME" "$DB_PASS"; then
    c_ok "Database is up"
    return 0
  fi

  c_warn "Database not reachable — trying to start it"

  # Prefer host port 5433 so we don't fight a system Postgres on 5432
  local compose_port="$DB_PORT"
  if [[ "$compose_port" == "5432" ]]; then
    if ss -ltn 2>/dev/null | grep -qE ':5432\s' || ss -ltn 2>/dev/null | grep -q ':5432$'; then
      c_warn "Host port 5432 is already in use — using $LOCAL_PG_PORT for project Postgres"
      compose_port="$LOCAL_PG_PORT"
      DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${compose_port}/${DB_NAME}?sslmode=disable"
      export DATABASE_URL
      parse_database_url "$DATABASE_URL"
    fi
  fi

  # 1) Docker Compose postgres (if daemon available)
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    c_info "Starting postgres via docker compose (host port ${compose_port})"
    if (cd "$ROOT" && POSTGRES_PORT="$compose_port" docker compose up -d postgres); then
      for _ in $(seq 1 30); do
        if db_ready "$DB_HOST" "$compose_port" "$DB_USER" "$DB_NAME" "$DB_PASS"; then
          DATABASE_URL="postgres://${DB_USER}:${DB_PASS}@${DB_HOST}:${compose_port}/${DB_NAME}?sslmode=disable"
          export DATABASE_URL
          c_ok "Database is up (docker) → $DATABASE_URL"
          return 0
        fi
        sleep 1
      done
      c_warn "Docker postgres started but not ready yet — trying fallbacks"
    else
      c_warn "Docker compose postgres failed (port conflict?) — trying fallbacks"
    fi
  else
    c_warn "Docker unavailable — skipping compose postgres"
  fi

  # 2) Local .pgdata instance
  if ensure_local_pg && db_ready "127.0.0.1" "$LOCAL_PG_PORT" "$DB_USER" "$DB_NAME" "$DB_PASS"; then
    return 0
  fi

  # 3) Last try: current DATABASE_URL again
  parse_database_url "$DATABASE_URL"
  if db_ready "$DB_HOST" "$DB_PORT" "$DB_USER" "$DB_NAME" "$DB_PASS"; then
    c_ok "Database is up"
    return 0
  fi

  c_err "Could not connect to Postgres. Fix DATABASE_URL in api/.env or start Postgres."
  exit 1
}

build_api() {
  export PATH="/snap/go/current/bin:${PATH:-}"
  if ! command -v go >/dev/null 2>&1; then
    c_err "Go not found in PATH"
    exit 1
  fi
  c_info "Building API..."
  (cd "$API_DIR" && go build -o bin/server ./cmd/server)
  c_ok "API binary ready"
}

# Resolve node/npm even when child shells skip .bashrc (nvm lives there).
resolve_node_path() {
  local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
  if [[ -s "$nvm_dir/nvm.sh" ]]; then
    # shellcheck disable=SC1090
    . "$nvm_dir/nvm.sh" >/dev/null 2>&1 || true
  fi
  if command -v npm >/dev/null 2>&1; then
    NODE_BIN_DIR="$(dirname "$(command -v npm)")"
    export PATH="$NODE_BIN_DIR:$PATH"
    return 0
  fi
  local latest
  latest="$(ls -1d "$nvm_dir"/versions/node/*/bin 2>/dev/null | sort -V | tail -1 || true)"
  if [[ -n "$latest" && -x "$latest/npm" ]]; then
    NODE_BIN_DIR="$latest"
    export PATH="$NODE_BIN_DIR:$PATH"
    return 0
  fi
  return 1
}

ensure_web_deps() {
  if [[ -x "$WEB_DIR/node_modules/.bin/next" ]]; then
    return 0
  fi
  c_info "Installing web dependencies (npm install)..."
  if ! (cd "$WEB_DIR" && npm install); then
    c_err "npm install failed in web/ — try: cd web && npm install"
    exit 1
  fi
  c_ok "Web dependencies ready"
}

wait_for_url() {
  local url="$1" label="$2" timeout="${3:-30}" i
  if ! command -v curl >/dev/null 2>&1; then
    c_warn "curl not found — skipping $label health check"
    return 0
  fi
  for ((i = 1; i <= timeout; i++)); do
    if curl -sf --max-time 2 "$url" >/dev/null 2>&1; then
      c_ok "$label is up → $url"
      return 0
    fi
    sleep 1
  done
  c_err "$label did not respond at $url (waited ${timeout}s)"
  return 1
}

verify_launched() {
  local failed=0 api_log web_log
  c_info "Waiting for services to respond..."
  if ! wait_for_url "http://127.0.0.1:${API_PORT}/healthz" "API" 30; then
    failed=1
    api_log="$LOG_DIR/$(log_slug "TSL API :${API_PORT}").log"
    if [[ -f "$api_log" ]]; then
      c_warn "API log (last 15 lines):"
      tail -15 "$api_log"
    fi
  fi
  if ! wait_for_url "http://127.0.0.1:${WEB_PORT}" "Web" 90; then
    failed=1
    web_log="$LOG_DIR/$(log_slug "TSL Web :${WEB_PORT}").log"
    if [[ -f "$web_log" ]]; then
      c_warn "Web log (last 15 lines):"
      tail -15 "$web_log"
    fi
  fi
  if [[ "$failed" -ne 0 ]]; then
    c_err "Startup failed — fix the errors above and run ./start.sh again"
    exit 1
  fi
}

open_terminal() {
  local title="$1"
  local cmd="$2"
  local slug
  slug="$(log_slug "$title")"
  local log_file="$LOG_DIR/${slug}.log"
  local pid_file="$LOG_DIR/${slug}.pid"
  local run_cmd="cd $(printf '%q' "$ROOT"); $cmd; echo; echo '[process exited — press Enter to close]'; read"
  local bash_lc=(bash --noprofile --norc -lc "$run_cmd")

  case "$TERM_KIND" in
    macos-terminal|macos-iterm)
      local app="Terminal" launcher
      [[ "$TERM_KIND" == "macos-iterm" ]] && app="iTerm"
      launcher="$LOG_DIR/${slug}.command"
      {
        printf '%s\n' '#!/bin/bash'
        printf '%s\n' "$cmd"
        printf '%s\n' 'echo'
        printf '%s\n' "read -r -p 'Press Enter to close...' _"
      } >"$launcher"
      chmod +x "$launcher"
      c_info "Opening $app — $title"
      open -a "$app" "$launcher"
      return
      ;;
  esac

  if [[ -z "$TERM_BIN" ]]; then
    c_warn "No GUI terminal found — starting '$title' in background"
    nohup bash --noprofile --norc -lc "$cmd" >"$log_file" 2>&1 &
    echo $! >"$pid_file"
    return
  fi

  c_info "Terminal: $TERM_BIN ($TERM_KIND) — $title"

  case "$TERM_KIND" in
    xdg)
      xdg-terminal-exec -- "${bash_lc[@]}" &
      ;;
    gnome|kgx)
      if [[ "$TERM_BIN" == "kgx" ]] || [[ "$TERM_KIND" == "kgx" ]]; then
        kgx --title "$title" --working-directory "$ROOT" -e "${bash_lc[@]}" &
      else
        gnome-terminal --title="$title" --working-directory="$ROOT" -- "${bash_lc[@]}" &
      fi
      ;;
    konsole)
      konsole --new-tab -p tabtitle="$title" --workdir "$ROOT" -e "${bash_lc[@]}" &
      ;;
    xfce)
      xfce4-terminal --title="$title" --working-directory="$ROOT" -e "${bash_lc[*]}" &
      ;;
    mate)
      mate-terminal --title="$title" --working-directory="$ROOT" -e "${bash_lc[*]}" &
      ;;
    tilix)
      tilix --working-directory="$ROOT" -t "$title" -e "${bash_lc[@]}" &
      ;;
    alacritty)
      alacritty --title "$title" --working-directory "$ROOT" -e "${bash_lc[@]}" &
      ;;
    kitty)
      kitty --title "$title" --directory "$ROOT" "${bash_lc[@]}" &
      ;;
    wezterm)
      wezterm start --cwd "$ROOT" -- "${bash_lc[@]}" &
      ;;
    *)
      if "$TERM_BIN" -T "$title" -e "${bash_lc[@]}" 2>/dev/null & then
        :
      elif "$TERM_BIN" --title "$title" -e "${bash_lc[@]}" 2>/dev/null & then
        :
      else
        "$TERM_BIN" -e "${bash_lc[@]}" &
      fi
      ;;
  esac
}

main() {
  c_info "The Strength Lab — start"
  if [[ -n "$TERM_BIN" ]]; then
    c_ok "Using terminal: $TERM_BIN ($TERM_KIND)"
  else
    c_warn "No GUI terminal detected — will run in background"
  fi
  ensure_env_files
  load_env

  c_info "Freeing ports $API_PORT and $WEB_PORT"
  kill_port "$API_PORT"
  kill_port "$WEB_PORT"
  # Also kill known leftover next/node by name if still bound oddly
  pkill -f "$API_DIR/bin/server" 2>/dev/null || true
  pkill -f "next dev --port ${WEB_PORT}" 2>/dev/null || true
  sleep 0.4

  ensure_db
  build_api

  if ! resolve_node_path; then
    c_err "npm/node not found. Install Node (nvm) or ensure npm is on PATH."
    exit 1
  fi
  c_ok "Using npm from $NODE_BIN_DIR"
  ensure_web_deps

  local api_cmd web_cmd
  api_cmd="cd $(printf '%q' "$API_DIR") && \
export PATH=/snap/go/current/bin:\$PATH && \
export DATABASE_URL=$(printf '%q' "$DATABASE_URL") && \
export API_ADDR=$(printf '%q' "$API_ADDR") && \
export JWT_SECRET=$(printf '%q' "$JWT_SECRET") && \
export CORS_ORIGIN=$(printf '%q' "$CORS_ORIGIN") && \
export SEED_ON_BOOT=$(printf '%q' "$SEED_ON_BOOT") && \
export REDIS_URL=$(printf '%q' "$REDIS_URL") && \
echo 'API → http://localhost:${API_PORT}' && \
exec ./bin/server"

  web_cmd="export PATH=$(printf '%q' "$NODE_BIN_DIR"):\$PATH && \
cd $(printf '%q' "$WEB_DIR") && \
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8080} && \
export NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL:-ws://localhost:8080} && \
echo 'Web → http://localhost:${WEB_PORT}' && \
command -v npm >/dev/null || { echo 'npm still not found'; exit 1; } && \
[[ -x node_modules/.bin/next ]] || { echo 'next not installed — run: cd web && npm install'; exit 1; } && \
exec npm run dev -- --port ${WEB_PORT}"

  c_info "Opening terminal 1 — backend (API)"
  open_terminal "TSL API :${API_PORT}" "$api_cmd"
  sleep 0.5
  c_info "Opening terminal 2 — frontend (Web)"
  open_terminal "TSL Web :${WEB_PORT}" "$web_cmd"

  verify_launched

  c_ok "Launched"
  echo
  echo "  Web  http://localhost:${WEB_PORT}"
  echo "  API  http://localhost:${API_PORT}/healthz"
  echo "  Demo coach / spotter / lifter  —  password123"
  echo
  if [[ -z "$TERM_BIN" ]]; then
    echo "  Logs: $LOG_DIR/"
  fi
}

main "$@"
