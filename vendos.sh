#!/usr/bin/env bash
# Deploy: run ON the Ampere host. The repo is the source; /home/opc/apps/girih-xr/site is a copy of the public files only.
set -euo pipefail
SRC=/mnt/data/workspace/girih-xr
DST=/home/opc/apps/girih-xr
sudo docker run --rm -v "$SRC":/s:ro -w /s node:22-slim sh -c "node test/girih.test.mjs && node test/quasi.test.mjs" >/dev/null
mkdir -p "$DST/site/vendor"
cp "$SRC"/docker-compose.yml "$SRC"/nginx.conf "$DST"/
cp "$SRC"/index.html "$SRC"/app.js "$SRC"/girih.js "$SRC"/lab.html "$SRC"/lab.js "$SRC"/zoom.html "$SRC"/zoom.js "$SRC"/quasi.js "$DST"/site/
cp "$SRC"/vendor/three.module.js "$DST"/site/vendor/
cd "$DST" && sudo docker compose up -d
for i in $(seq 15); do curl -fs -o /dev/null http://127.0.0.1:8322/ && exit 0; sleep 1; done
echo "health failed"; exit 1
