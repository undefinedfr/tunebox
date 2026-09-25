# syntax=docker/dockerfile:1

# ---------- 1. Interface ----------
FROM node:24-bookworm-slim AS web
WORKDIR /app/web
COPY web/package.json web/package-lock.json ./
RUN npm ci
COPY web/ ./
RUN node scripts/make-icons.mjs && npm run build

# ---------- 2. Dependances serveur ----------
FROM node:24-bookworm-slim AS server-deps
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
# better-sqlite3 utilise un binaire precompile quand il existe pour l'archi ;
# la chaine de compilation n'est la qu'en repli (ARM ancien, ABI Node inedite).
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && npm ci --omit=dev \
 && apt-get purge -y python3 make g++ \
 && apt-get autoremove -y \
 && rm -rf /var/lib/apt/lists/*

# ---------- 3. Image finale ----------
FROM node:24-bookworm-slim
# XDG_CACHE_HOME pointe dans le volume : le solveur EJS de yt-dlp est
# telecharge une fois et conserve d'un redemarrage a l'autre.
ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8080 \
    YTDLP_BIN=/opt/ytdlp/bin/yt-dlp \
    XDG_CACHE_HOME=/data/.cache

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      ffmpeg python3 python3-venv ca-certificates curl unzip \
      libheif1 libheif-examples \
 && python3 -m venv /opt/ytdlp \
 && /opt/ytdlp/bin/pip install --no-cache-dir --upgrade pip yt-dlp \
 && rm -rf /var/lib/apt/lists/*

# YouTube impose une epreuve JavaScript que yt-dlp doit resoudre avec un vrai
# moteur JS. Sans Deno dans le PATH, yt-dlp se rabat sur un client degrade et
# toutes les videos remontent en "This video is not available".
RUN set -eux; \
    case "$(dpkg --print-architecture)" in \
      amd64) target='x86_64-unknown-linux-gnu' ;; \
      arm64) target='aarch64-unknown-linux-gnu' ;; \
      *) echo "architecture non supportee : $(dpkg --print-architecture)" >&2; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/deno.zip \
      "https://github.com/denoland/deno/releases/latest/download/deno-${target}.zip"; \
    unzip -q /tmp/deno.zip -d /usr/local/bin; \
    rm /tmp/deno.zip; \
    chmod +x /usr/local/bin/deno; \
    deno --version

WORKDIR /app
COPY --from=server-deps /app/server/node_modules ./server/node_modules
COPY server/package.json ./server/package.json
COPY server/src ./server/src
COPY --from=web /app/web/dist ./web/dist
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

VOLUME ["/data"]
EXPOSE 8080

HEALTHCHECK --interval=60s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:8080/api/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
