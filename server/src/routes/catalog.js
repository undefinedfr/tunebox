import { catalogVersion, db } from '../lib/db.js'

export function serializeTrack(row) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || '',
    duration: row.duration,
    audio: row.audio_file ? `/media/${row.audio_file}` : null,
    cover: row.cover_file ? `/covers/${row.cover_file}` : null,
    color: row.color,
    emoji: row.emoji || '',
  }
}

export default async function catalogRoutes(app) {
  // Le seul endpoint que la tablette appelle en usage normal.
  app.get('/api/catalog', async (_request, reply) => {
    const rows = db
      .prepare("SELECT * FROM tracks WHERE status = 'ready' ORDER BY position ASC, created_at ASC")
      .all()
    reply.header('Cache-Control', 'no-cache')
    // Le catalogue est la seule porte d'entree des clients tiers (l'app
    // Android, un script de sauvegarde). Il ne contient que des titres et des
    // chemins de fichiers, deja servis sans authentification.
    reply.header('Access-Control-Allow-Origin', '*')
    return { version: catalogVersion(), tracks: rows.map(serializeTrack) }
  })
}
