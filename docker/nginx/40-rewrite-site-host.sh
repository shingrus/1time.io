#!/bin/sh
set -eu

SITE_ROOT="${SITE_ROOT:-/usr/share/nginx/html}"
APP_HOSTNAME="${APP_HOSTNAME:-onetimelink.me}"

if [ "${APP_HOSTNAME}" = "onetimelink.me" ]; then
    exit 0
fi

escape_replacement() {
    printf '%s' "$1" | sed 's/[&|]/\\&/g'
}

escaped_host="$(escape_replacement "${APP_HOSTNAME}")"

find "${SITE_ROOT}" -type f \
    \( -name '*.html' -o -name '*.js' -o -name '*.json' -o -name '*.txt' -o -name '*.xml' -o -name '*.css' \) \
    | while IFS= read -r file; do
        tmp_file="${file}.tmp"
        sed \
            -e "s|https://onetimelink\\.me|https://${escaped_host}|g" \
            -e "s|OneTimeLink\\.me|${escaped_host}|g" \
            -e "s|onetimelink\\.me|${escaped_host}|g" \
            "${file}" > "${tmp_file}"
        mv "${tmp_file}" "${file}"
    done
