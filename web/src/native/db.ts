import { CapacitorSQLite, SQLiteConnection, type SQLiteDBConnection } from '@capacitor-community/sqlite'

const DB_NAME = 'tunebox'
const DB_VERSION = 1

const sqlite = new SQLiteConnection(CapacitorSQLite)
let opening: Promise<SQLiteDBConnection> | null = null

/**
 * Le catalogue embarque reprend les colonnes utiles du schema serveur, sans
 * ce qui ne concerne que l'import (source, statut, erreur). L'app native ne
 * telecharge rien depuis YouTube : elle ne fait que recopier un catalogue deja
 * pret.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS tracks (
    id         TEXT PRIMARY KEY,
    title      TEXT NOT NULL,
    subtitle   TEXT NOT NULL DEFAULT '',
    duration   INTEGER,
    audio_file TEXT,
    cover_file TEXT,
    color      TEXT NOT NULL DEFAULT '#6366f1',
    emoji      TEXT NOT NULL DEFAULT '',
    position   INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS idx_tracks_position ON tracks(position);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`

async function open(): Promise<SQLiteDBConnection> {
  // Une connexion survit au rechargement du WebView alors que le module JS,
  // lui, repart de zero : sans ce rattrapage, createConnection leve un
  // "Connection already exists" au premier retour en avant-plan.
  const already = (await sqlite.isConnection(DB_NAME, false)).result
  const db = already
    ? await sqlite.retrieveConnection(DB_NAME, false)
    : await sqlite.createConnection(DB_NAME, false, 'no-encryption', DB_VERSION, false)

  if (!(await db.isDBOpen()).result) await db.open()
  await db.execute(SCHEMA)
  return db
}

export function getDb(): Promise<SQLiteDBConnection> {
  if (!opening) {
    opening = open().catch((error) => {
      opening = null
      throw error
    })
  }
  return opening
}

export type TrackRow = {
  id: string
  title: string
  subtitle: string
  duration: number | null
  audio_file: string | null
  cover_file: string | null
  color: string
  emoji: string
  position: number
}

export async function readTracks(): Promise<TrackRow[]> {
  const db = await getDb()
  const result = await db.query('SELECT * FROM tracks ORDER BY position ASC')
  return (result.values ?? []) as TrackRow[]
}

const INSERT_TRACK = `
  INSERT INTO tracks
    (id, title, subtitle, duration, audio_file, cover_file, color, emoji, position)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`

/**
 * Remplace le catalogue d'un bloc. Le `BEGIN`/`COMMIT` n'est pas a ecrire a la
 * main : executeSet ouvre deja sa propre transaction, et une transaction
 * imbriquee echoue sur « no current transaction ». Une synchro interrompue
 * laisse donc l'ancien catalogue intact plutot qu'une liste a moitie ecrite.
 */
export async function replaceTracks(rows: TrackRow[]): Promise<void> {
  const db = await getDb()
  await db.executeSet([
    { statement: 'DELETE FROM tracks', values: [] },
    ...rows.map((row) => ({
      statement: INSERT_TRACK,
      values: [
        row.id,
        row.title,
        row.subtitle,
        row.duration,
        row.audio_file,
        row.cover_file,
        row.color,
        row.emoji,
        row.position,
      ],
    })),
  ])
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb()
  const result = await db.query('SELECT value FROM settings WHERE key = ?', [key])
  return (result.values?.[0]?.value as string | undefined) ?? null
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb()
  await db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  )
}
