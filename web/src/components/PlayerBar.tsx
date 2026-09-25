import { NextIcon, NoteIcon, PauseIcon, PlayIcon, PrevIcon } from './Icons'
import type { Track } from '../lib/types'

type Props = {
  track: Track
  playing: boolean
  position: number
  duration: number
  onToggle: () => void
  onNext: () => void
  onPrevious: () => void
  onSeek: (seconds: number) => void
}

function clock(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export function PlayerBar({
  track, playing, position, duration, onToggle, onNext, onPrevious, onSeek,
}: Props) {
  const total = duration || track.duration || 0
  const ratio = total ? Math.min(100, (position / total) * 100) : 0

  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-white/10 bg-ink-900/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
      {/* Barre de progression en haut du lecteur, tapable sur toute sa largeur. */}
      <div className="relative h-2 w-full bg-white/10">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-[width] duration-300"
          style={{ width: `${ratio}%` }}
        />
        <input
          type="range"
          min={0}
          max={Math.max(total, 1)}
          step={1}
          value={Math.min(position, total || 1)}
          onChange={(e) => onSeek(Number(e.target.value))}
          aria-label="Position dans le morceau"
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </div>

      <div className="flex items-center gap-3 px-3 py-3 sm:gap-4 sm:px-5">
        <div
          className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-2xl shadow-md sm:h-[72px] sm:w-[72px]"
          style={{ backgroundColor: track.color }}
        >
          {track.cover ? (
            <img src={track.cover} alt="" draggable={false} className="h-full w-full object-cover" />
          ) : (
            <span className="text-3xl">{track.emoji || <NoteIcon />}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-extrabold sm:text-xl">{track.title}</p>
          <p className="truncate text-sm text-white/55">
            {clock(position)} / {clock(total)}
            {track.subtitle ? ` · ${track.subtitle}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={onPrevious}
            aria-label="Morceau précédent"
            className="grid h-14 w-14 place-items-center rounded-full text-white/80 transition active:scale-90 active:bg-white/10"
          >
            <PrevIcon />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={playing ? 'Pause' : 'Lecture'}
            className="grid h-[68px] w-[68px] place-items-center rounded-full bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow-lg transition active:scale-90"
          >
            {playing ? <PauseIcon /> : <PlayIcon className="ml-1 h-10 w-10" />}
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Morceau suivant"
            className="grid h-14 w-14 place-items-center rounded-full text-white/80 transition active:scale-90 active:bg-white/10"
          >
            <NextIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
