import { YTDLP_BIN } from './config.js'
import { humanise } from './errors.js'
import { run } from './proc.js'

const MAX_PREVIEW_ENTRIES = 100

/** Miniature YouTube toujours disponible, contrairement a maxresdefault. */
export function youtubeThumb(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

function cleanTitle(raw) {
  // Les titres YouTube sont pollues : on degrossit, le parent corrige ensuite.
  return String(raw || '')
    .replace(/\((official|officiel|official video|clip officiel|audio|lyrics?|paroles|hd|4k)[^)]*\)/gi, '')
    .replace(/\[(official|officiel|audio|lyrics?|paroles|hd|4k)[^\]]*\]/gi, '')
    .replace(/\b(official (music )?video|clip officiel|version longue|lyrics? video)\b/gi, '')
    .replace(/\s*[-|]\s*$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function normaliseEntry(entry) {
  const id = entry.id || entry.url
  if (!id) return null
  return {
    sourceId: id,
    sourceUrl: entry.webpage_url || `https://www.youtube.com/watch?v=${id}`,
    rawTitle: entry.title || 'Sans titre',
    title: cleanTitle(entry.title),
    subtitle: entry.uploader || entry.channel || entry.artist || '',
    duration: entry.duration ? Math.round(entry.duration) : null,
    thumbnail: youtubeThumb(id),
  }
}

/**
 * Metadonnees seules, aucun telechargement. C'est ce qui alimente l'ecran de
 * confirmation : le parent voit le titre et la pochette avant que le disque
 * ne bouge.
 */
export async function probe(url) {
  const stdout = await runFriendly(
    YTDLP_BIN,
    [
      '-J',
      '--flat-playlist',
      '--no-warnings',
      '--ignore-config',
      '--playlist-end', String(MAX_PREVIEW_ENTRIES),
      url,
    ],
    { timeout: 90_000 }
  )

  let info
  try {
    info = JSON.parse(stdout)
  } catch {
    throw new Error("Reponse illisible de yt-dlp. L'URL est-elle correcte ?")
  }

  if (info._type === 'playlist' && Array.isArray(info.entries)) {
    return {
      kind: 'playlist',
      playlistTitle: info.title || 'Playlist',
      entries: info.entries.map(normaliseEntry).filter(Boolean),
    }
  }

  const single = normaliseEntry(info)
  if (!single) throw new Error('Aucune piste exploitable a cette adresse.')
  return { kind: 'video', playlistTitle: null, entries: [single] }
}

/** Enveloppe run() pour que les erreurs remontent en francais jusqu'a l'admin. */
async function runFriendly(...args) {
  try {
    return await run(...args)
  } catch (err) {
    throw new Error(humanise(err.message))
  }
}

/** Recherche YouTube — utilisee par l'import de playlists Spotify. */
export async function search(query, limit = 1) {
  const stdout = await runFriendly(
    YTDLP_BIN,
    ['-J', '--flat-playlist', '--no-warnings', '--ignore-config', `ytsearch${limit}:${query}`],
    { timeout: 60_000 }
  )
  const info = JSON.parse(stdout)
  return (info.entries || []).map(normaliseEntry).filter(Boolean)
}

export async function ytdlpVersion() {
  try {
    return (await run(YTDLP_BIN, ['--version'], { timeout: 15_000 })).trim()
  } catch {
    return null
  }
}
