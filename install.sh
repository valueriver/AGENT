#!/usr/bin/env bash

set -euo pipefail

REPO_URL="${AGENT_REPO_URL:-https://github.com/valueriver/AGENT.git}"
REPO_BRANCH="${AGENT_REPO_BRANCH:-main}"
INSTALL_ROOT="${AGENT_INSTALL_ROOT:-$HOME/.local/share/agent-cli}"
BIN_DIR="${AGENT_BIN_DIR:-$HOME/.local/bin}"
WRAPPER_PATH="$BIN_DIR/agent"
CONFIG_DIR="${AGENT_CONFIG_DIR:-$HOME/.config/agent-cli}"
CONFIG_FILE="$CONFIG_DIR/config.env"
SERVER_HOST="${AGENT_SERVER_HOST:-127.0.0.1}"
SERVER_PORT="${AGENT_SERVER_PORT:-9500}"
SERVER_LOG="${AGENT_SERVER_LOG:-$INSTALL_ROOT/agent-server.log}"

log() {
  printf '[agent-install] %s\n' "$1"
}

fail() {
  printf '[agent-install] error: %s\n' "$1" >&2
  exit 1
}

has_cmd() {
  command -v "$1" >/dev/null 2>&1
}

run_root() {
  if [[ "${EUID:-$(id -u)}" -eq 0 ]]; then
    "$@"
    return
  fi

  if has_cmd sudo; then
    sudo "$@"
    return
  fi

  fail "need root privileges to install system packages: $*"
}

detect_pkg_manager() {
  if has_cmd apt-get; then
    printf 'apt\n'
    return
  fi
  if has_cmd dnf; then
    printf 'dnf\n'
    return
  fi
  if has_cmd yum; then
    printf 'yum\n'
    return
  fi
  if has_cmd apk; then
    printf 'apk\n'
    return
  fi
  if has_cmd zypper; then
    printf 'zypper\n'
    return
  fi
  fail "unsupported package manager; install git, curl, node, npm manually"
}

install_packages() {
  local pm="$1"
  shift

  case "$pm" in
    apt)
      run_root apt-get update
      run_root apt-get install -y "$@"
      ;;
    dnf)
      run_root dnf install -y "$@"
      ;;
    yum)
      run_root yum install -y "$@"
      ;;
    apk)
      run_root apk add --no-cache "$@"
      ;;
    zypper)
      run_root zypper --non-interactive install "$@"
      ;;
  esac
}

ensure_git() {
  local pm
  if has_cmd git; then
    return
  fi

  pm="$(detect_pkg_manager)"
  log "git not found, installing"
  case "$pm" in
    apt|dnf|yum|zypper)
      install_packages "$pm" git
      ;;
    apk)
      install_packages "$pm" git
      ;;
  esac
}

ensure_curl() {
  local pm
  if has_cmd curl; then
    return
  fi

  pm="$(detect_pkg_manager)"
  log "curl not found, installing"
  install_packages "$pm" curl
}

ensure_node() {
  local pm
  if has_cmd node && has_cmd npm; then
    return
  fi

  pm="$(detect_pkg_manager)"
  log "node/npm not found, installing"
  case "$pm" in
    apt)
      install_packages "$pm" nodejs npm
      ;;
    dnf|yum)
      install_packages "$pm" nodejs npm
      ;;
    apk)
      install_packages "$pm" nodejs npm
      ;;
    zypper)
      install_packages "$pm" nodejs20 npm20 || install_packages "$pm" nodejs npm
      ;;
  esac

  has_cmd node || fail "node installation failed"
  has_cmd npm || fail "npm installation failed"
}

append_path_hint() {
  local shell_name profile_line profile_file
  shell_name="$(basename "${SHELL:-}")"
  profile_line='export PATH="$HOME/.local/bin:$PATH"'

  if [[ ":$PATH:" == *":$HOME/.local/bin:"* ]]; then
    return 0
  fi

  case "$shell_name" in
    zsh)
      profile_file="$HOME/.zshrc"
      ;;
    bash)
      if [[ -f "$HOME/.bashrc" ]]; then
        profile_file="$HOME/.bashrc"
      else
        profile_file="$HOME/.profile"
      fi
      ;;
    *)
      profile_file="$HOME/.profile"
      ;;
  esac

  touch "$profile_file"
  if ! grep -Fqx "$profile_line" "$profile_file"; then
    printf '\n%s\n' "$profile_line" >> "$profile_file"
    log "added ~/.local/bin to PATH in $profile_file" >&2
  fi
  printf '%s\n' "$profile_file"
}

write_wrapper() {
  mkdir -p "$BIN_DIR"
  cat > "$WRAPPER_PATH" <<EOF
#!/usr/bin/env bash
set -euo pipefail
if [[ -f "$CONFIG_FILE" ]]; then
  set -a
  . "$CONFIG_FILE"
  set +a
fi
exec node "$INSTALL_ROOT/bin/agent.js" "\$@"
EOF
  chmod +x "$WRAPPER_PATH"
}

install_project() {
  if [[ -d "$INSTALL_ROOT/.git" ]]; then
    log "updating code from $REPO_URL"
    git -C "$INSTALL_ROOT" remote set-url origin "$REPO_URL"
    git -C "$INSTALL_ROOT" fetch origin "$REPO_BRANCH" --depth 1
    git -C "$INSTALL_ROOT" checkout -B "$REPO_BRANCH" "origin/$REPO_BRANCH"
    git -C "$INSTALL_ROOT" reset --hard "origin/$REPO_BRANCH"
    git -C "$INSTALL_ROOT" clean -fd
    return
  fi

  log "cloning code from $REPO_URL"
  rm -rf "$INSTALL_ROOT"
  git clone --depth 1 --branch "$REPO_BRANCH" "$REPO_URL" "$INSTALL_ROOT"
}

start_server() {
  ensure_curl

  if curl -fsS "http://$SERVER_HOST:$SERVER_PORT/health" >/dev/null 2>&1; then
    log "server already running at http://$SERVER_HOST:$SERVER_PORT"
    return
  fi

  log "starting local agent server"
  mkdir -p "$(dirname "$SERVER_LOG")"
  nohup node "$INSTALL_ROOT/src/server/index.js" >"$SERVER_LOG" 2>&1 &

  for _ in 1 2 3 4 5 6 7 8 9 10; do
    sleep 1
    if curl -fsS "http://$SERVER_HOST:$SERVER_PORT/health" >/dev/null 2>&1; then
      log "server started at http://$SERVER_HOST:$SERVER_PORT"
      return
    fi
  done

  fail "server failed to start; check $SERVER_LOG"
}

print_usage() {
  local profile_file="${1:-}"

  printf '\n'
  printf 'Installed to: %s\n' "$INSTALL_ROOT"
  printf 'Command: %s\n' "$WRAPPER_PATH"
  printf 'Config: %s\n' "$CONFIG_FILE"
  printf 'Server: http://%s:%s\n' "$SERVER_HOST" "$SERVER_PORT"
  printf '\n'
  printf 'Next:\n'
  printf '  agent --config https://api.openai.com/v1/chat/completions YOUR_API_KEY gpt-4.1-mini\n'
  printf '  agent --help\n'
  printf '  agent\n'
  printf '\n'
  printf 'Tip:\n'
  printf '  the local server is already started by install.sh\n'
  printf '  later runs of agent will also auto-start the server if needed\n'
  if [[ -n "$profile_file" && ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
    printf '\n'
    printf 'PATH not active in this shell yet. Run:\n'
    printf '  source "%s"\n' "$profile_file"
    printf 'or reopen the terminal.\n'
  fi
}

main() {
  local profile_file=""

  ensure_git
  ensure_node

  log "install root: $INSTALL_ROOT"
  install_project

  log "installing npm dependencies"
  npm install --omit=dev --prefix "$INSTALL_ROOT"

  log "creating terminal command: $WRAPPER_PATH"
  write_wrapper
  profile_file="$(append_path_hint || true)"

  start_server
  log "install complete"
  print_usage "$profile_file"
}

main "$@"
