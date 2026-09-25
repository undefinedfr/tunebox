import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_ENABLED } from './config.js'

let cachedToken = null // { value, expiresAt }

/**
 * Client credentials : lecture seule sur les playlists publiques.
 * Aucun compte Premium, aucun login utilisateur.
 */
async function token() {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value

  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Authentification Spotify refusee (HTTP ${res.status})`)

  const data = await res.json()
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 }
  return cachedToken.value
}

export function parsePlaylistId(input) {
  const raw = String(input || '').trim()
  return (
    raw.match(/playlist[/:]([a-zA-Z0-9]+)/)?.[1] ||
    (/^[a-zA-Z0-9]{22}$/.test(raw) ? raw : null)
  )
}

export async function fetchPlaylist(input) {
  if (!SPOTIFY_ENABLED) {
    throw new Error("Import Spotify non configure : renseigne SPOTIFY_CLIENT_ID et SPOTIFY_CLIENT_SECRET.")
  }
  const id = parsePlaylistId(input)
  if (!id) throw new Error('Lien de playlist Spotify non reconnu.')

  const auth = await token()
  const meta = await spotifyGet(`https://api.spotify.com/v1/playlists/${id}?fields=name`, auth)

  const items = []
  let url = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100&fields=next,items(track(name,duration_ms,artists(name),album(images)))`
  while (url && items.length < 200) {
    const page = await spotifyGet(url, auth)
    for (const item of page.items || []) {
      const track = item.track
      if (!track?.name) continue
      const artists = (track.artists || []).map((a) => a.name).filter(Boolean)
      items.push({
        title: track.name,
        subtitle: artists.join(', '),
        duration: track.duration_ms ? Math.round(track.duration_ms / 1000) : null,
        // images[0] est la plus grande ; on garde la pochette officielle.
        thumbnail: track.album?.images?.[0]?.url || null,
        query: `${artists[0] || ''} ${track.name}`.trim(),
      })
    }
    url = page.next
  }

  return { name: meta.name || 'Playlist Spotify', items }
}

async function spotifyGet(url, auth) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${auth}` },
    signal: AbortSignal.timeout(20_000),
  })
  if (res.status === 404) throw new Error('Playlist introuvable ou privee.')
  if (!res.ok) throw new Error(`Spotify a repondu HTTP ${res.status}`)
  return res.json()
}
