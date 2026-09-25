import type { Track } from '../lib/types'
import { COVERS_DIR, MEDIA_DIR, download, ensureDirs, exists, listFiles, remove } from './fs'
import { replaceTracks, setSetting, type TrackRow } from './db'

export type SyncProgress = {
  done: number
  total: number
  label: string
  phase: 'catalog' | 'files' | 'cleanup' | 'done'
}

export type SyncResult = {
  tracks: number
  downloaded: number
  failed: string[]
}

export class SyncError extends Error {}

/** Accepte « nas.local:8080 » aussi bien que « http://nas.local:8080/ ». */
export function normalizeBaseUrl(input: string): string {
  const trimmed = input.trim().replace(/\/+$/, '')
  if (!trimmed) throw new SyncError('Adresse vide')
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`
  try {
    return new URL(withScheme).origin
  } catch {
    throw new SyncError('Adresse invalide')
  }
}

async function fetchCatalog(base: string): Promise<{ version: number; tracks: Track[] }> {
  let response: Response
  try {
    response = await fetch(`${base}/api/catalog`)
  } catch {
    throw new SyncError(`Serveur injoignable sur ${base}`)
  }
  if (!response.ok) throw new SyncError(`Le serveur a repondu ${response.status}`)
  const data = await response.json()
  if (!Array.isArray(data?.tracks)) throw new SyncError('Ce n’est pas un serveur Tunebox')
  return data
}

const fileName = (url: string) => url.split('/').pop() ?? ''

/**
 * Recopie l'integralite du catalogue sur l'appareil : catalogue en SQLite,
 * audio et pochettes en fichiers. Une fois cette passe terminee, l'app n'a
 * plus jamais besoin du serveur pour jouer de la musique.
 *
 * Les fichiers deja presents ne sont pas retelecharges — une synchro apres
 * l'ajout d'un morceau ne coute que ce morceau.
 */
export async function sync(
  baseUrl: string,
  onProgress: (progress: SyncProgress) => void
): Promise<SyncResult> {
  const base = normalizeBaseUrl(baseUrl)

  onProgress({ done: 0, total: 0, label: 'Lecture du catalogue…', phase: 'catalog' })
  const catalog = await fetchCatalog(base)
  await ensureDirs()

  const playable: TrackRow[] = []
  const failed: string[] = []
  let downloaded = 0
  const total = catalog.tracks.length

  for (const [index, track] of catalog.tracks.entries()) {
    onProgress({ done: index, total, label: track.title, phase: 'files' })

    const audio = track.audio ? fileName(track.audio) : null
    if (!audio) {
      failed.push(track.title)
      continue
    }

    try {
      const audioPath = `${MEDIA_DIR}/${audio}`
      if (!(await exists(audioPath))) {
        await download(`${base}${track.audio}`, audioPath)
        downloaded += 1
      }
    } catch {
      // Un morceau sans audio serait une tuile muette : on l'ecarte du
      // catalogue local plutot que de le laisser echouer sous le doigt.
      failed.push(track.title)
      continue
    }

    let cover = track.cover ? fileName(track.cover) : null
    if (cover) {
      try {
        const coverPath = `${COVERS_DIR}/${cover}`
        if (!(await exists(coverPath))) {
          await download(`${base}${track.cover}`, coverPath)
          downloaded += 1
        }
      } catch {
        // Une pochette manquante se remplace par la couleur et l'emoji.
        cover = null
      }
    }

    playable.push({
      id: track.id,
      title: track.title,
      subtitle: track.subtitle ?? '',
      duration: track.duration,
      audio_file: audio,
      cover_file: cover,
      color: track.color || '#6366f1',
      emoji: track.emoji ?? '',
      position: index,
    })
  }

  onProgress({ done: total, total, label: 'Enregistrement…', phase: 'cleanup' })
  await replaceTracks(playable)

  // Menage : les fichiers des morceaux retires du catalogue occupent sinon la
  // tablette pour toujours.
  const keepAudio = new Set(playable.map((row) => row.audio_file).filter(Boolean) as string[])
  const keepCovers = new Set(playable.map((row) => row.cover_file).filter(Boolean) as string[])
  for (const [dir, keep] of [
    [MEDIA_DIR, keepAudio],
    [COVERS_DIR, keepCovers],
  ] as const) {
    for (const name of await listFiles(dir)) {
      if (!keep.has(name)) await remove(`${dir}/${name}`)
    }
  }

  await setSetting('server_url', base)
  await setSetting('catalog_version', String(catalog.version ?? 0))
  await setSetting('synced_at', String(Date.now()))

  onProgress({ done: total, total, label: 'Termine', phase: 'done' })
  return { tracks: playable.length, downloaded, failed }
}
