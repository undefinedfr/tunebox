#!/bin/sh
set -e

# YouTube change regulierement : une version figee de yt-dlp finit toujours par
# casser. On tente une mise a jour a chaque demarrage, sans bloquer si le NAS
# n'a pas de reseau sortant a ce moment-la.
if [ "${YTDLP_AUTO_UPDATE:-1}" = "1" ]; then
  echo "[demarrage] mise a jour de yt-dlp..."
  /opt/ytdlp/bin/pip install --no-cache-dir --quiet --upgrade yt-dlp \
    || echo "[demarrage] mise a jour impossible, on garde la version installee"
fi
echo "[demarrage] yt-dlp $(/opt/ytdlp/bin/yt-dlp --version 2>/dev/null || echo 'introuvable')"

cd /app/server
exec node src/index.js
