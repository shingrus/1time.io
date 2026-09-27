#!/bin/sh
set -eu

SITE_ROOT="${SITE_ROOT:-/usr/share/nginx/html}"
APP_HOSTNAME="${APP_HOSTNAME:-}"

# Warn instead of exiting: older images accepted these values, and a pull must not take the site down.
invalid_hostname() {
    echo "WARNING: invalid APP_HOSTNAME '${APP_HOSTNAME}': set a hostname such as secrets.example.com (no scheme, port, or path). Page metadata keeps 1time.io." >&2
    exit 0
}

# Hostnames are inserted into prebuilt HTML and JavaScript. Reject punctuation
# that could break the rewrite and obvious malformed hostnames.
[ -n "${APP_HOSTNAME}" ] || invalid_hostname
[ "${#APP_HOSTNAME}" -le 253 ] || invalid_hostname
case "${APP_HOSTNAME}" in
    *[!a-zA-Z0-9.-]*|.*|*.|*..*|-*|*-|*.-*|*-.*) invalid_hostname ;;
esac

if [ "${APP_HOSTNAME}" = "1time.io" ]; then
    exit 0
fi

find "${SITE_ROOT}" -type f \
    \( -name '*.html' -o -name '*.js' -o -name '*.json' -o -name '*.txt' -o -name '*.xml' -o -name '*.css' -o -name '*.webmanifest' \) \
    | while IFS= read -r file; do
        tmp_file="${file}.tmp"
        sed \
            -e "s|https://1time\\.io|https://${APP_HOSTNAME}|g" \
            -e "s|1time\\.io|${APP_HOSTNAME}|g" \
            "${file}" > "${tmp_file}"
        mv "${tmp_file}" "${file}"
    done
