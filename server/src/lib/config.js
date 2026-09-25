import 'dotenv/config'
import path from 'node:path'
import fs from 'node:fs'

const root = path.resolve(import.meta.dirname, '../../..')

export const DATA_DIR = path.resolve(root, process.env.DATA_DIR || './data')
export const MEDIA_DIR = path.join(DATA_DIR, 'media')
export const COVERS_DIR = path.join(DATA_DIR, 'covers')
export const TMP_DIR = path.join(DATA_DIR, 'tmp')
export const DB_PATH = path.join(DATA_DIR, 'catalog.db')
export const WEB_DIST = path.join(root, 'web/dist')

export const PORT = Number(process.env.PORT || 8080)
export const ADMIN_PIN = String(process.env.ADMIN_PIN || '1234')
export const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-me'

export const YTDLP_BIN = process.env.YTDLP_BIN || 'yt-dlp'
export const FFMPEG_BIN = process.env.FFMPEG_BIN || 'ffmpeg'

// Derriere un proxy TLS (Caddy, Nginx, Traefik), le cookie de session peut
// etre marque Secure. En direct sur le LAN en http://, ce serait un cookie que
// le navigateur refuse d'envoyer — d'ou le defaut a 0.
export const COOKIE_SECURE = process.env.COOKIE_SECURE === '1'

export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || ''
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || ''
export const SPOTIFY_ENABLED = Boolean(SPOTIFY_CLIENT_ID && SPOTIFY_CLIENT_SECRET)

for (const dir of [DATA_DIR, MEDIA_DIR, COVERS_DIR, TMP_DIR]) {
  fs.mkdirSync(dir, { recursive: true })
}

// On repart d'un tmp propre a chaque demarrage : un conteneur tue en plein
// telechargement laisse des fragments .part qui ne servent plus a rien.
for (const entry of fs.readdirSync(TMP_DIR)) {
  fs.rmSync(path.join(TMP_DIR, entry), { recursive: true, force: true })
}

export const FFPROBE_BIN = process.env.FFPROBE_BIN || 'ffprobe'
