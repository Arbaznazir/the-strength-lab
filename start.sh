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

load_env() {
  if [[ -f "$ENV_FILE" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
      if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
        export "$line"
      fi
    done < "$ENV_FILE"
  fi
  if [[ -f "$WEB_DIR/.env" ]]; then
    while IFS= read -r line || [[ -n "$line" ]]; do
      [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
      if [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]]; then
        export "$line"
      fi
    done < "$WEB_DIR/.env"
  fi
  DATABASE_URL="${DATABASE_URL:-postgres://strengthlab:strengthlab@127.0.0.1:5432/strengthlab?sslmode=disable}"
  API_ADDR="${API_ADDR:-:$API_PORT}"
  JWT_SECRET="${JWT_SECRET:-change-me-in-production-use-long-random-string}"
  CORS_ORIGIN="${CORS_ORIGIN:-http://localhost:3000}"
  SEED_ON_BOOT="${SEED_ON_BOOT:-true}"
  REDIS_URL="${REDIS_URL:-redis://127.0.0.1:6379/0}"
  NEXT_PUBLIC_API_URL="${NEXT_PUBLIC_API_URL:-http://localhost:8080}"
  NEXT_PUBLIC_WS_URL="${NEXT_PUBLIC_WS_URL:-ws://localhost:8080}"
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
  local pids
  pids="$(ss -ltnp 2>/dev/null | awk -v p=":$port" '$4 ~ p"$" {print}' | grep -oP 'pid=\K[0-9]+' | sort -u || true)"
  if [[ -z "$pids" ]]; then
    # fuser fallback
    if command -v fuser >/dev/null 2>&1; then
      pids="$(fuser "${port}/tcp" 2>/dev/null | tr -s ' ' '\n' | grep -E '^[0-9]+$' | sort -u || true)"
    fi
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

  # 1) Docker Compose postgres (if daemon available)
  if command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1; then
    c_info "Starting postgres via docker compose"
    (cd "$ROOT" && docker compose up -d postgres) || true
    for _ in $(seq 1 30); do
      if db_ready "$DB_HOST" "$DB_PORT" "$DB_USER" "$DB_NAME" "$DB_PASS"; then
        c_ok "Database is up (docker)"
        return 0
      fi
      sleep 1
    done
  else
    c_warn "Docker unavailable — skipping compose postgres"
  fi

  # 2) Local .pgdata instance
  if ensure_local_pg && db_ready "127.0.0.1" "$LOCAL_PG_PORT" "$DB_USER" "$DB_NAME" "$DB_PASS"; then
    return 0
  fi

  # 3) Last try: original URL again (maybe system postgres came up)
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

open_terminal() {
  local title="$1"
  local cmd="$2"
  local run_cmd="cd $(printf '%q' "$ROOT"); $cmd; echo; echo '[process exited — press Enter to close]'; read"
  local bash_lc=(bash --noprofile --norc -lc "$run_cmd")

  if [[ -z "$TERM_BIN" ]]; then
    c_warn "No GUI terminal found — starting '$title' in background"
    nohup bash --noprofile --norc -lc "$cmd" >"$LOG_DIR/${title// /_}.log" 2>&1 &
    echo $! >"$LOG_DIR/${title// /_}.pid"
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

  web_cmd="cd $(printf '%q' "$WEB_DIR") && \
export NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-http://localhost:8080} && \
export NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL:-ws://localhost:8080} && \
echo 'Web → http://localhost:${WEB_PORT}' && \
exec npm run dev -- --port ${WEB_PORT}"

  c_info "Opening terminal 1 — backend (API)"
  open_terminal "TSL API :${API_PORT}" "$api_cmd"
  sleep 0.5
  c_info "Opening terminal 2 — frontend (Web)"
  open_terminal "TSL Web :${WEB_PORT}" "$web_cmd"

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
