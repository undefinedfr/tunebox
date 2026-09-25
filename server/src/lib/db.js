import Database from 'better-sqlite3'
import { DB_PATH } from './config.js'

export const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.pragma('foreign_keys = ON')

db.exec(`
  CREATE TABLE IF NOT EXISTS tracks (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    subtitle    TEXT,
    source_url  TEXT,
    source_id   TEXT,
    search_query TEXT,
    duration    INTEGER,
    audio_file  TEXT,
    cover_file  TEXT,
    cover_source TEXT,
    color       TEXT NOT NULL DEFAULT '#6366f1',
    emoji       TEXT,
    position    INTEGER NOT NULL DEFAULT 0,
    status      TEXT NOT NULL DEFAULT 'pending',
    error       TEXT,
    created_at  INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_tracks_position ON tracks(position);
  CREATE INDEX IF NOT EXISTS idx_tracks_status   ON tracks(status);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

// Migrations additives : sures a rejouer, suffisantes pour ce format de donnees.
for (const [column, ddl] of [['search_query', 'TEXT']]) {
  const exists = db.prepare('PRAGMA table_info(tracks)').all().some((c) => c.name === column)
  if (!exists) db.exec(`ALTER TABLE tracks ADD COLUMN ${column} ${ddl}`)
}

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : fallback
}

export function setSetting(key, value) {
  db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ).run(key, String(value))
}

/**
 * La tablette compare ce numero a chaque ouverture pour savoir si elle doit
 * recharger le catalogue et precharger les nouveaux morceaux.
 */
export function bumpCatalogVersion() {
  const next = Number(getSetting('catalog_version', '0')) + 1
  setSetting('catalog_version', next)
  return next
}

export function catalogVersion() {
  return Number(getSetting('catalog_version', '0'))
}

export function nextPosition() {
  const row = db.prepare('SELECT COALESCE(MAX(position), -1) AS max FROM tracks').get()
  return row.max + 1
}
