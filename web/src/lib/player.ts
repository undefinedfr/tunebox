import { useCallback, useEffect, useRef, useState } from 'react'
import type { Track } from './types'

/**
 * Un seul element <audio> pour toute l'app. Les callbacks natifs ('ended'...)
 * lisent l'etat via des refs : sans ca ils resteraient figes sur le premier
 * rendu et l'enchainement automatique sauterait toujours au meme morceau.
 */
export function usePlayer(tracks: Track[]) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const tracksRef = useRef(tracks)
  const currentIdRef = useRef<string | null>(null)

  const [currentId, setCurrentId] = useState<string | null>(null)
  const [playing, setPlaying] = useState(false)
  const [position, setPosition] = useState(0)
  const [duration, setDuration] = useState(0)

  tracksRef.current = tracks
  currentIdRef.current = currentId

  if (!audioRef.current && typeof Audio !== 'undefined') {
    audioRef.current = new Audio()
    audioRef.current.preload = 'metadata'
  }

  const indexOf = (id: string | null) =>
    id ? tracksRef.current.findIndex((t) => t.id === id) : -1

  const load = useCallback((track: Track, autoplay: boolean) => {
    const audio = audioRef.current
    if (!audio || !track.audio) return
    if (audio.src !== new URL(track.audio, location.origin).href) {
      audio.src = track.audio
    }
    setCurrentId(track.id)
    setPosition(0)
    if (autoplay) {
      audio.play().catch(() => setPlaying(false))
    }
  }, [])

  const toggle = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    if (audio.paused) audio.play().catch(() => setPlaying(false))
    else audio.pause()
  }, [])

  /** Tape sur une tuile : lance le morceau, ou met en pause si c'est deja lui. */
  const select = useCallback(
    (track: Track) => {
      if (track.id === currentIdRef.current) toggle()
      else load(track, true)
    },
    [load, toggle]
  )

  const step = useCallback(
    (delta: number) => {
      const list = tracksRef.current
      if (!list.length) return
      const index = indexOf(currentIdRef.current)
      // Depuis rien, "suivant" demarre au debut de la liste.
      const nextIndex = index < 0 ? 0 : (index + delta + list.length) % list.length
      load(list[nextIndex], true)
    },
    [load]
  )

  const next = useCallback(() => step(1), [step])

  /** Avant 3 s on revient au morceau precedent, apres on rembobine celui-ci. */
  const previous = useCallback(() => {
    const audio = audioRef.current
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0
      return
    }
    step(-1)
  }, [step])

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current
    if (audio && Number.isFinite(audio.duration)) {
      audio.currentTime = Math.max(0, Math.min(seconds, audio.duration))
      setPosition(audio.currentTime)
    }
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => setPosition(audio.currentTime)
    const onMeta = () => setDuration(audio.duration || 0)
    const onEnded = () => step(1)
    const onError = () => setPlaying(false)

    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('timeupdate', onTime)
    audio.addEventListener('loadedmetadata', onMeta)
    audio.addEventListener('ended', onEnded)
    audio.addEventListener('error', onError)
    return () => {
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('timeupdate', onTime)
      audio.removeEventListener('loadedmetadata', onMeta)
      audio.removeEventListener('ended', onEnded)
      audio.removeEventListener('error', onError)
    }
  }, [step])

  // Ecran de verrouillage, boutons du casque, notification Android.
  const current = tracks.find((t) => t.id === currentId) ?? null
  useEffect(() => {
    if (!('mediaSession' in navigator)) return
    if (!current) {
      navigator.mediaSession.metadata = null
      return
    }
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.title,
      artist: current.subtitle || 'Ma musique',
      artwork: current.cover
        ? [{ src: current.cover, sizes: '512x512', type: 'image/jpeg' }]
        : undefined,
    })
    navigator.mediaSession.setActionHandler('play', () => audioRef.current?.play())
    navigator.mediaSession.setActionHandler('pause', () => audioRef.current?.pause())
    navigator.mediaSession.setActionHandler('nexttrack', next)
    navigator.mediaSession.setActionHandler('previoustrack', previous)
  }, [current, next, previous])

  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.playbackState = playing ? 'playing' : 'paused'
    }
  }, [playing])

  return { current, currentId, playing, position, duration, select, toggle, next, previous, seek }
}
