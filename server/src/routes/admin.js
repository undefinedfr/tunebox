import { nanoid } from 'nanoid'
import {
  COOKIE_NAME, COOKIE_OPTS, checkPin, issueToken, requireAdmin, verifyToken,
} from '../lib/auth.js'
import { SPOTIFY_ENABLED } from '../lib/config.js'
import { bumpCatalogVersion, db, nextPosition } from '../lib/db.js'
import { enqueue, queueState } from '../lib/ingest.js'
import { makeCover, removeFiles } from '../lib/media.js'
import { fetchPlaylist } from '../lib/spotify.js'
import { probe, search, ytdlpVersion } from '../lib/ytdlp.js'
import { serializeTrack } from './catalog.js'

const PALETTE = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#ef4444', '#8b5cf6', '#84cc16']

function adminRow(row) {
  return {
    ...serializeTrack(row),
    position: row.position,
    status: row.status,
    error: row.error,
    sourceUrl: row.source_url,
    searchQuery: row.search_query,
  }
}

function allTracks() {
  return db
    .prepare('SELECT * FROM tracks ORDER BY position ASC, created_at ASC')
    .all()
    .map(adminRow)
}

export default async function adminRoutes(app) {
  // ---------- session ----------

  app.post('/api/admin/login', async (request, reply) => {
    if (!checkPin(request.body?.pin)) {
      // Petit delai : rend le bruteforce du PIN penible sans gener un parent.
      await new Promise((r) => setTimeout(r, 600))
      return reply.code(401).send({ error: 'PIN incorrect' })
    }
    reply.setCookie(COOKIE_NAME, issueToken(), COOKIE_OPTS)
    return { ok: true }
  })

  app.post('/api/admin/logout', async (_request, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' })
    return { ok: true }
  })

  app.get('/api/admin/session', async (request) => ({
    authenticated: verifyToken(request.cookies?.[COOKIE_NAME]),
    spotify: SPOTIFY_ENABLED,
  }))

  // ---------- tout ce qui suit exige le PIN ----------

  app.register(async (guarded) => {
    guarded.addHook('preHandler', requireAdmin)

    guarded.get('/api/admin/status', async () => ({
      ...queueState(),
      ytdlp: await ytdlpVersion(),
      spotify: SPOTIFY_ENABLED,
    }))

    guarded.get('/api/admin/tracks', async () => ({ tracks: allTracks() }))

    /** Metadonnees seules : rien ne touche le disque avant confirmation. */
    guarded.post('/api/admin/preview', async (request, reply) => {
      const url = String(request.body?.url || '').trim()
      if (!url) return reply.code(400).send({ error: 'URL manquante' })
      try {
        return await probe(url)
      } catch (err) {
        return reply.code(422).send({ error: err.message })
      }
    })

    guarded.post('/api/admin/spotify', async (request, reply) => {
      try {
        return await fetchPlaylist(request.body?.url)
      } catch (err) {
        return reply.code(422).send({ error: err.message })
      }
    })

    guarded.post('/api/admin/search', async (request, reply) => {
      const query = String(request.body?.query || '').trim()
      if (!query) return reply.code(400).send({ error: 'Recherche vide' })
      try {
        return { results: await search(query, Number(request.body?.limit) || 5) }
      } catch (err) {
        return reply.code(422).send({ error: err.message })
      }
    })

    /** Creation en masse : une ligne 'pending' par titre, puis la file fait le reste. */
    guarded.post('/api/admin/tracks', async (request, reply) => {
      const items = Array.isArray(request.body?.items) ? request.body.items : []
      if (!items.length) return reply.code(400).send({ error: 'Aucun morceau a ajouter' })

      const insert = db.prepare(`
        INSERT INTO tracks (id, title, subtitle, source_url, source_id, search_query,
                            duration, cover_source, color, emoji, position, status, created_at)
        VALUES (@id, @title, @subtitle, @source_url, @source_id, @search_query,
                @duration, @cover_source, @color, @emoji, @position, 'pending', @created_at)
      `)

      const created = []
      let position = nextPosition()
      const now = Date.now()

      const insertAll = db.transaction(() => {
        for (const [index, item] of items.entries()) {
          const title = String(item.title || '').trim()
          if (!title) continue
          if (!item.sourceUrl && !item.query) continue

          const id = nanoid(12)
          insert.run({
            id,
            title: title.slice(0, 120),
            subtitle: String(item.subtitle || '').trim().slice(0, 120) || null,
            source_url: item.sourceUrl || null,
            source_id: item.sourceId || null,
            search_query: item.query || null,
            duration: Number.isFinite(item.duration) ? item.duration : null,
            cover_source: item.coverUrl || item.thumbnail || null,
            color: PALETTE[(position + index) % PALETTE.length],
            emoji: String(item.emoji || '').slice(0, 8) || null,
            position: position++,
            created_at: now + index,
          })
          created.push(id)
        }
      })
      insertAll()

      if (!created.length) return reply.code(400).send({ error: 'Aucun morceau valide' })
      for (const id of created) enqueue(id)
      return { added: created.length, ids: created }
    })

    guarded.patch('/api/admin/tracks/:id', async (request, reply) => {
      const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(request.params.id)
      if (!track) return reply.code(404).send({ error: 'Morceau introuvable' })

      const body = request.body || {}
      const fields = {
        title: body.title !== undefined ? String(body.title).trim().slice(0, 120) : track.title,
        subtitle: body.subtitle !== undefined ? String(body.subtitle).trim().slice(0, 120) : track.subtitle,
        color: body.color !== undefined ? String(body.color).slice(0, 16) : track.color,
        emoji: body.emoji !== undefined ? String(body.emoji).slice(0, 8) : track.emoji,
      }
      if (!fields.title) return reply.code(400).send({ error: 'Le titre ne peut pas etre vide' })

      db.prepare('UPDATE tracks SET title = ?, subtitle = ?, color = ?, emoji = ? WHERE id = ?')
        .run(fields.title, fields.subtitle || null, fields.color, fields.emoji || null, track.id)
      bumpCatalogVersion()
      return { track: adminRow(db.prepare('SELECT * FROM tracks WHERE id = ?').get(track.id)) }
    })

    /** Pochette : soit un fichier envoye depuis le telephone, soit une URL. */
    guarded.post('/api/admin/tracks/:id/cover', async (request, reply) => {
      const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(request.params.id)
      if (!track) return reply.code(404).send({ error: 'Morceau introuvable' })

      try {
        let coverFile
        if (request.isMultipart()) {
          const file = await request.file()
          if (!file) return reply.code(400).send({ error: 'Aucun fichier recu' })
          coverFile = await makeCover(track.id, { buffer: await file.toBuffer() })
        } else {
          const url = String(request.body?.url || '').trim()
          if (!url) return reply.code(400).send({ error: 'URL manquante' })
          coverFile = await makeCover(track.id, { url })
        }
        db.prepare('UPDATE tracks SET cover_file = ? WHERE id = ?').run(coverFile, track.id)
        // Le nom change a chaque remplacement : on nettoie derriere nous.
        if (track.cover_file && track.cover_file !== coverFile) {
          await removeFiles({ coverFile: track.cover_file }).catch(() => {})
        }
        bumpCatalogVersion()
        return { track: adminRow(db.prepare('SELECT * FROM tracks WHERE id = ?').get(track.id)) }
      } catch (err) {
        return reply.code(422).send({ error: err.message })
      }
    })

    guarded.post('/api/admin/tracks/:id/retry', async (request, reply) => {
      const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(request.params.id)
      if (!track) return reply.code(404).send({ error: 'Morceau introuvable' })
      db.prepare("UPDATE tracks SET status = 'pending', error = NULL WHERE id = ?").run(track.id)
      enqueue(track.id)
      return { ok: true }
    })

    guarded.delete('/api/admin/tracks/:id', async (request, reply) => {
      const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(request.params.id)
      if (!track) return reply.code(404).send({ error: 'Morceau introuvable' })
      db.prepare('DELETE FROM tracks WHERE id = ?').run(track.id)
      await removeFiles({ audioFile: track.audio_file, coverFile: track.cover_file })
      bumpCatalogVersion()
      return { ok: true }
    })

    guarded.post('/api/admin/reorder', async (request, reply) => {
      const ids = Array.isArray(request.body?.ids) ? request.body.ids : []
      if (!ids.length) return reply.code(400).send({ error: 'Ordre vide' })
      const update = db.prepare('UPDATE tracks SET position = ? WHERE id = ?')
      db.transaction(() => ids.forEach((id, index) => update.run(index, id)))()
      bumpCatalogVersion()
      return { tracks: allTracks() }
    })
  })
}
