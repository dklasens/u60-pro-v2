#!/bin/sh
# Fixed application-owned boot entries only; preserve the stock script.
set -eu
file=/etc/rc.local
staged=/etc/rc.local.open-u60-new
cp -p "$file" "$staged"
for line in "$@"; do
    case "$line" in
        --remove-debug) sed -i '/^echo [0-9] > .*usb_op$/d' "$staged"; continue ;;
        'sh /data/local/tmp/start_zte_agent.sh'|'sh /data/local/tmp/start_dropbear.sh'|'sh /data/local/tmp/start_dashboard.sh') ;;
        *) echo 'Unsupported startup entry' >&2; exit 64 ;;
    esac
    if ! grep -qFx "$line" "$staged"; then
        if grep -q '^exit 0' "$staged"; then sed -i "/^exit 0/i $line" "$staged"
        else printf '%s\n' "$line" >> "$staged"; fi
    fi
done
sh -n "$staged"
mv "$staged" "$file"
sync
