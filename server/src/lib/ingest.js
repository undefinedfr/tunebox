import { bumpCatalogVersion, db } from './db.js'
import { downloadAudio, makeCover, removeFiles } from './media.js'
import { search, youtubeThumb } from './ytdlp.js'

// Une recherche peut tomber sur une video supprimee ou bloquee : on garde des
// suppleants plutot que de faire echouer l'import sur le premier candidat.
const SEARCH_CANDIDATES = 3

const queue = []
const progress = new Map() // id -> { stage, percent }
let running = false

export function queueState() {
  return {
    running,
    pending: queue.length,
    progress: Object.fromEntries(progress),
  }
}

export function enqueue(id) {
  if (!queue.includes(id)) queue.push(id)
  progress.set(id, { stage: 'queued', percent: 0 })
  drain()
}

/** Au demarrage, on reprend ce qu'un redemarrage du conteneur a laisse en plan. */
export function resumeInterrupted() {
  const rows = db
    .prepare("SELECT id FROM tracks WHERE status IN ('pending','downloading') ORDER BY position")
    .all()
  for (const row of rows) enqueue(row.id)
  return rows.length
}

async function drain() {
  if (running) return
  running = true
  try {
    while (queue.length) {
      await processOne(queue.shift())
    }
  } finally {
    running = false
  }
}

/**
 * Les sources a tenter, dans l'ordre. Un morceau ajoute par lien n'en a qu'une ;
 * un morceau venu d'une recherche ou d'une playlist Spotify en a plusieurs.
 */
async function resolveCandidates(track, id) {
  if (track.source_url) {
    return [{ sourceUrl: track.source_url, sourceId: track.source_id, thumbnail: null }]
  }
  if (!track.search_query) throw new Error('Aucune source pour ce morceau.')

  progress.set(id, { stage: 'search', percent: 0 })
  const found = await search(track.search_query, SEARCH_CANDIDATES)
  if (!found.length) throw new Error(`Introuvable sur YouTube : ${track.search_query}`)
  return found
}

async function processOne(id) {
  const track = db.prepare('SELECT * FROM tracks WHERE id = ?').get(id)
  if (!track) {
    progress.delete(id)
    return
  }

  db.prepare("UPDATE tracks SET status = 'downloading', error = NULL WHERE id = ?").run(id)
  progress.set(id, { stage: 'download', percent: 0 })

  try {
    const candidates = await resolveCandidates(track, id)

    let audio = null
    let chosen = null
    let lastError = null
    for (const candidate of candidates) {
      try {
        audio = await downloadAudio(candidate.sourceUrl, id, (percent) => {
          progress.set(id, { stage: 'download', percent })
        })
        chosen = candidate
        break
      } catch (err) {
        lastError = err
      }
    }
    if (!audio) throw lastError ?? new Error('Aucune source exploitable.')

    db.prepare('UPDATE tracks SET source_url = ?, source_id = ? WHERE id = ?')
      .run(chosen.sourceUrl, chosen.sourceId ?? null, id)

    progress.set(id, { stage: 'cover', percent: 100 })
    let coverFile = track.cover_file
    // Ajout par mots-cles : aucune miniature fournie, on la deduit de la video
    // effectivement retenue.
    const coverSource =
      track.cover_source || chosen.thumbnail || (chosen.sourceId ? youtubeThumb(chosen.sourceId) : null)
    if (!coverFile && coverSource) {
      try {
        coverFile = await makeCover(id, { url: coverSource })
      } catch {
        // Une pochette manquante ne doit pas faire echouer un import : la
        // pastille couleur + emoji prend le relais dans l'interface.
        coverFile = null
      }
    }

    db.prepare(
      `UPDATE tracks
         SET status = 'ready', audio_file = ?, duration = COALESCE(?, duration),
             cover_file = ?, error = NULL
       WHERE id = ?`
    ).run(audio.audioFile, audio.duration, coverFile, id)

    bumpCatalogVersion()
    progress.delete(id)
  } catch (err) {
    db.prepare("UPDATE tracks SET status = 'error', error = ? WHERE id = ?").run(
      String(err.message || err).slice(0, 500),
      id
    )
    progress.delete(id)
    await removeFiles({ audioFile: `${id}.m4a` }).catch(() => {})
  }
}
