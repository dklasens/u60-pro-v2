#!/bin/sh
set -eu
sh /data/local/tmp/stop_open_u60_listener.sh dashboard-uhttpd 1F90
sleep 1
docroot=/data/www
if [ -L /data/www.current ]; then docroot=$(readlink -f /data/www.current); fi
test -d "$docroot"
trap '' HUP
nohup /data/bin/dashboard-uhttpd -f -h "$docroot" -p 0.0.0.0:8080 -D >/tmp/dashboard-uhttpd.log 2>&1 </dev/null &
echo $! > /var/run/dashboard-uhttpd.pid
