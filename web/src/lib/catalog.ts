import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'
import { AUDIO_CACHE, COVER_CACHE } from './caches'
import type { Track } from './types'

/**
 * Telecharge les fichiers dans le Cache API, un par un pour ne pas saturer le
 * Wi-Fi de la tablette. Une fois passe ici, le catalogue fonctionne meme NAS
 * eteint.
 */
async function prefetch(tracks: Track[]) {
  if (!('caches' in window)) return
  const [audio, covers] = await Promise.all([caches.open(AUDIO_CACHE), caches.open(COVER_CACHE)])

  for (const track of tracks) {
    for (const [cache, url] of [
      [covers, track.cover],
      [audio, track.audio],
    ] as const) {
      if (!url) continue
      try {
        if (await cache.match(url)) continue
        await cache.add(url)
      } catch {
        // Hors ligne ou fichier absent : on retentera a la prochaine ouverture.
      }
    }
  }
}

/** Supprime du cache les morceaux retires du catalogue. */
async function evict(tracks: Track[]) {
  if (!('caches' in window)) return
  const keep = new Set(tracks.flatMap((t) => [t.audio, t.cover].filter(Boolean) as string[]))
  for (const name of [AUDIO_CACHE, COVER_CACHE]) {
    const cache = await caches.open(name)
    for (const request of await cache.keys()) {
      if (!keep.has(new URL(request.url).pathname)) await cache.delete(request)
    }
  }
}

export function useCatalog() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const versionRef = useRef<number>(-1)

  const refresh = useCallback(async () => {
    try {
      const data = await api.catalog()
      setStatus('ready')
      if (data.version === versionRef.current) return
      versionRef.current = data.version
      setTracks(data.tracks)
      await prefetch(data.tracks)
      await evict(data.tracks)
    } catch {
      // Le service worker sert la derniere version connue ; si meme lui echoue,
      // c'est un premier lancement hors ligne.
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'))
    }
  }, [])

  useEffect(() => {
    refresh()
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)

    // La tablette reste allumee des heures sans que personne n'y touche : sans
    // ce rappel, un morceau ajoute depuis le Mac n'apparaitrait qu'au prochain
    // redemarrage de l'app. C'est aussi ce qui la repare toute seule quand le
    // reseau revient apres une coupure.
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 30_000)

    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.clearInterval(timer)
    }
  }, [refresh])

  return { tracks, status, refresh }
}
