#!/usr/bin/env bash
#
# Provision a Debian/Ubuntu host for 1time.io (packages, user, env file, nginx, units, deploy timer).
# Releases are installed by the timer, not here: see AGENTS.md, Deployment.
#
#   sudo env REDIS_PASS=... CF_API_TOKEN=... CF_ZONE_ID=... HC_PING_DEPLOY=... NTFY_URL=... \
#       ./scripts/update_vm.sh --init       first time on a fresh box
#   sudo ./scripts/update_vm.sh             after changing nginx, units or this script
#
# Use `sudo env VAR=...`, not `sudo VAR=... ./script`. Never rewrites /etc/1time/env once it exists.

set -euo pipefail

INIT_MODE=0
for arg in "$@"; do
    case "${arg}" in
        --init) INIT_MODE=1 ;;
        -h|--help)
            sed -n '3,9p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "Unknown argument: ${arg}" >&2
            exit 1
            ;;
    esac
done

APP_USER="${APP_USER:-onetime}"
APP_GROUP="${APP_GROUP:-$APP_USER}"
INSTALL_ROOT="${INSTALL_ROOT:-/opt/1time}"
BIN_DIR="${INSTALL_ROOT}/bin"
FILE_STORAGE_DIR="${FILE_STORAGE_DIR:-${INSTALL_ROOT}/files}"
STATIC_ROOT="${STATIC_ROOT:-/var/www/1time}"

# Written to the env file on --init only. Everything the service reads lives
# there, so the unit carries no configuration and can be replaced freely.
LISTEN_ADDR="${LISTEN_ADDR:-127.0.0.1:8080}"
REDIS_HOST="${REDIS_HOST:-127.0.0.1:6379}"
REDIS_PASS="${REDIS_PASS:-}"
CF_API_TOKEN="${CF_API_TOKEN:-}"
CF_ZONE_ID="${CF_ZONE_ID:-}"
HC_PING_DEPLOY="${HC_PING_DEPLOY:-}"
NTFY_URL="${NTFY_URL:-}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYSTEMD_SOURCE="${REPO_ROOT}/configs/systemd"
UPDATER_SOURCE="${REPO_ROOT}/scripts/1time-deploy-update"
NGINX_SOURCE="${REPO_ROOT}/configs/nginx"
NGINX_SITE_TARGET="/etc/nginx/sites-available/1time.conf"
NGINX_SITE_LINK="/etc/nginx/sites-enabled/1time.conf"
NGINX_UPSTREAM_DIR="/etc/nginx/1time"
NGINX_LIVE_LINK="/etc/nginx/conf.d/1time-live.conf"
ENV_DIR="/etc/1time"
ENV_FILE="${ENV_DIR}/env"

if [[ "${EUID}" -ne 0 ]]; then
    echo "Run this script as root or via sudo." >&2
    exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
    echo "This script currently supports Debian/Ubuntu hosts only." >&2
    exit 1
fi

for source in "${UPDATER_SOURCE}" "${SYSTEMD_SOURCE}/1time@.service" "${SYSTEMD_SOURCE}/1time-deploy-update.service" \
    "${SYSTEMD_SOURCE}/1time-deploy-update.timer" "${NGINX_SOURCE}/upstream-8080.conf" "${NGINX_SOURCE}/upstream-8081.conf"; do
    if [[ ! -f "${source}" ]]; then
        echo "Missing ${source}." >&2
        exit 1
    fi
done

# 1time.conf includes every file in configs/nginx/snippets/, so a missing
# snippet makes nginx refuse to start rather than degrade. Fail early instead.
if [[ ! -f "${NGINX_SOURCE}/1time.conf" ]]; then
    echo "Missing ${NGINX_SOURCE}/1time.conf." >&2
    exit 1
fi
for snippet in 1time-security-headers.conf 1time-security-headers-sensitive.conf cloudflare-real-ip.conf; do
    if [[ ! -f "${NGINX_SOURCE}/snippets/${snippet}" ]]; then
        echo "Missing ${NGINX_SOURCE}/snippets/${snippet}." >&2
        exit 1
    fi
done

# An update run needs the box already provisioned. Without this an operator who
# forgets --init gets a service that starts with no configuration at all.
if [[ "${INIT_MODE}" -eq 0 && ! -f "${ENV_FILE}" ]]; then
    echo "Missing ${ENV_FILE}. Run with --init for a first-time install." >&2
    exit 1
fi

# --- first-time provisioning ---------------------------------------------
if [[ "${INIT_MODE}" -eq 1 ]]; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y nginx redis-server rsync curl

    if ! id -u "${APP_USER}" >/dev/null 2>&1; then
        adduser --disabled-password --gecos "" "${APP_USER}"
    fi

    install -d -m 700 -o "${APP_USER}" -g "${APP_GROUP}" "/home/${APP_USER}/.ssh"
    install -d -m 750 -o root -g "${APP_GROUP}" "${ENV_DIR}"

    if [[ -f "${ENV_FILE}" ]]; then
        echo "Keeping existing ${ENV_FILE}. Edit it directly to change secrets."
    else
        # 0640, root-owned and group-readable by ${APP_GROUP} — readable by the
        # service, not by other users, and never visible in ps the way a value
        # passed on a command line is.
        umask 027
        cat > "${ENV_FILE}" <<ENVEOF
LISTEN_ADDR=${LISTEN_ADDR}
REDISHOST=${REDIS_HOST}
REDISPASS=${REDIS_PASS}
FILE_STORAGE_DIR=${FILE_STORAGE_DIR}
# Optional: Cloudflare cache purge after every deploy. Leave blank to skip it.
CF_API_TOKEN=${CF_API_TOKEN}
CF_ZONE_ID=${CF_ZONE_ID}
HC_PING_DEPLOY=${HC_PING_DEPLOY}
NTFY_URL=${NTFY_URL}
ENVEOF
        chown root:"${APP_GROUP}" "${ENV_FILE}"
        chmod 0640 "${ENV_FILE}"
        echo "Wrote ${ENV_FILE}."
    fi
fi

# --- every run ------------------------------------------------------------
install -d -m 755 -o root -g root "${INSTALL_ROOT}" "${BIN_DIR}" "${INSTALL_ROOT}/releases"
install -d -m 755 -o "${APP_USER}" -g "${APP_GROUP}" "${STATIC_ROOT}"
install -d -m 750 -o "${APP_USER}" -g "${APP_GROUP}" "${FILE_STORAGE_DIR}"
install -d -m 755 -o root -g root /var/lib/1time /var/lib/1time/state

#certbot certonly --manual --preferred-challenges dns -d 1time.io -d '*.1time.io'

# --- nginx configuration -------------------------------------------------
# Snippets keep the same names here as in the repo, so configs/nginx/snippets/
# maps 1:1 onto /etc/nginx/snippets/ and the include paths need no rewriting.
install -d -m 755 /etc/nginx/snippets
install -m 0644 "${NGINX_SOURCE}/snippets/1time-security-headers.conf"           /etc/nginx/snippets/
install -m 0644 "${NGINX_SOURCE}/snippets/1time-security-headers-sensitive.conf" /etc/nginx/snippets/
install -m 0644 "${NGINX_SOURCE}/snippets/cloudflare-real-ip.conf"               /etc/nginx/snippets/
install -d -m 755 "${NGINX_UPSTREAM_DIR}"
install -m 0644 "${NGINX_SOURCE}/upstream-8080.conf" "${NGINX_SOURCE}/upstream-8081.conf" "${NGINX_UPSTREAM_DIR}/"
if [[ ! -e "${NGINX_LIVE_LINK}" && ! -L "${NGINX_LIVE_LINK}" ]]; then
    ln -s "${NGINX_UPSTREAM_DIR}/upstream-8080.conf" "${NGINX_LIVE_LINK}"
fi
install -m 0644 "${NGINX_SOURCE}/1time.conf" "${NGINX_SITE_TARGET}"
ln -sfn "${NGINX_SITE_TARGET}" "${NGINX_SITE_LINK}"

# Drop a stale unsuffixed link from older installs, which would otherwise
# load the same server_name twice.
if [[ -L /etc/nginx/sites-enabled/1time ]]; then
    rm -f /etc/nginx/sites-enabled/1time
fi

tmp_unit="$(mktemp)"
sed \
    -e "s#^User=.*#User=${APP_USER}#" \
    -e "s#^Group=.*#Group=${APP_GROUP}#" \
    -e "s#^WorkingDirectory=.*#WorkingDirectory=${INSTALL_ROOT}#" \
    -e "s#^EnvironmentFile=.*#EnvironmentFile=-${ENV_FILE}#" \
    -e "s#^ExecStart=/opt/1time/#ExecStart=${INSTALL_ROOT}/#" \
    "${SYSTEMD_SOURCE}/1time@.service" > "${tmp_unit}"
install -m 0644 "${tmp_unit}" /etc/systemd/system/1time@.service
sed \
    -e "s#^EnvironmentFile=.*#EnvironmentFile=-${ENV_FILE}#" \
    -e "s#^ExecStart=/opt/1time/#ExecStart=${INSTALL_ROOT}/#" \
    "${SYSTEMD_SOURCE}/1time-deploy-update.service" > "${tmp_unit}"
install -m 0644 "${tmp_unit}" /etc/systemd/system/1time-deploy-update.service
rm -f "${tmp_unit}"
install -m 0644 "${SYSTEMD_SOURCE}/1time-deploy-update.timer" /etc/systemd/system/
install -m 0755 -o root -g root "${UPDATER_SOURCE}" "${BIN_DIR}/1time-deploy-update"

systemctl daemon-reload
if [[ "${INIT_MODE}" -eq 1 ]]; then
    systemctl enable --now redis-server
fi
# Validate before reloading: a missing include or bad directive fails hard,
# and it is better to leave the running config in place than to break it.
nginx -t
if [[ "${INIT_MODE}" -eq 1 ]]; then
    systemctl enable --now nginx
fi
systemctl reload nginx
systemctl enable --now 1time-deploy-update.timer

ENV_FILE="${ENV_FILE}" "${UPDATER_SOURCE}" --purge-cache

systemctl --no-pager --full status 1time-deploy-update.timer || true
