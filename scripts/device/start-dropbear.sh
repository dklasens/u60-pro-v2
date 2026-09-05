#!/bin/sh
set -eu
sh /data/local/tmp/stop_open_u60_listener.sh dropbear 08AE
sleep 1
/data/bin/dropbear -s -P /var/run/open-u60-dropbear.pid -p 2222 \
    -r /etc/dropbear/dropbear_ed25519_host_key \
    -r /etc/dropbear/dropbear_rsa_host_key
