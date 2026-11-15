#!/usr/bin/env bash
set -euo pipefail

frontend_dir=$(cd "$(dirname "$0")/.." && pwd)
cli="$frontend_dir/../cli/index.mjs"
case $(uname -m) in
    arm64|aarch64) default_image=mcr.microsoft.com/powershell:7.4-azurelinux-3.0-arm64 ;;
    *) default_image=mcr.microsoft.com/powershell:7.4-ubuntu-22.04 ;;
esac
image=${POWERSHELL_IMAGE:-$default_image}
api_origin=${API_ORIGIN:-http://127.0.0.1:8080}
api_port=${api_origin##*:}

if command -v pwsh >/dev/null 2>&1; then
    run_pwsh() { pwsh -NoProfile -File "$frontend_dir/scripts/test-powershell-snippet.ps1" "$@"; }
else
    container=$(docker run -d --rm --add-host host.docker.internal:host-gateway \
        -v "$frontend_dir:/work:ro" "$image" sleep infinity)
    trap 'docker rm -f "$container" >/dev/null' EXIT
    docker exec "$container" bash -c \
        "if command -v apt-get >/dev/null; then apt-get update -qq && apt-get install -y -qq socat; else tdnf install -y socat; fi >/dev/null && (socat TCP-LISTEN:$api_port,bind=127.0.0.1,fork,reuseaddr TCP:host.docker.internal:$api_port &) && sleep 1" >&2
    run_pwsh() { docker exec "$container" pwsh -NoProfile -File /work/scripts/test-powershell-snippet.ps1 "$@"; }
fi

check_same() {
    if [ "$2" != "$3" ]; then echo "FAIL $1: expected '$2', got '$3'"; exit 1; fi
    echo "PASS $1"
}

run_pwsh -ApiOrigin "$api_origin"

text="interop $(date +%s) ключ"

link=$(run_pwsh -ApiOrigin "$api_origin" -CreateOnly "$text")
check_same "snippet link read by CLI" "$text" "$(node "$cli" read "$link" 2>/dev/null)"

link=$(printf '%s' "$text" | node "$cli" send --host "$api_origin")
check_same "CLI link read by snippet" "$text" "$(run_pwsh -ApiOrigin "$api_origin" -ReadLink "$link")"
