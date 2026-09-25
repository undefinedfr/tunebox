import { useCallback, useEffect, useState } from 'react'
import type { Track } from '../lib/types'
import { readTracks } from './db'
import { COVERS_DIR, MEDIA_DIR, dirSrc } from './fs'

/**
 * Meme signature que le `useCatalog` du web, mais sans reseau : tout vient de
 * la base SQLite et des fichiers deposes par la synchronisation. C'est ce qui
 * permet a l'APK de fonctionner serveur eteint, en avion, ou sans jamais avoir
 * eu de Wi-Fi depuis la premiere synchro.
 */
export function useCatalog() {
  const [tracks, setTracks] = useState<Track[]>([])
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')

  const refresh = useCallback(async () => {
    try {
      const [rows, media, covers] = await Promise.all([readTracks(), dirSrc(MEDIA_DIR), dirSrc(COVERS_DIR)])
      setTracks(
        rows.map((row) => ({
          id: row.id,
          title: row.title,
          subtitle: row.subtitle ?? '',
          duration: row.duration,
          audio: row.audio_file ? media(row.audio_file) : null,
          cover: row.cover_file ? covers(row.cover_file) : null,
          color: row.color,
          emoji: row.emoji ?? '',
        }))
      )
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }, [])

  useEffect(() => {
    refresh()
    // Retour depuis l'ecran parent apres une synchro : on relit la base.
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [refresh])

  return { tracks, status, refresh }
}
