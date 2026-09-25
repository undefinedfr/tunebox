import { Equalizer } from './Equalizer'
import type { Track } from '../lib/types'

type Props = {
  track: Track
  isCurrent: boolean
  playing: boolean
  onSelect: (track: Track) => void
}

export function TrackTile({ track, isCurrent, playing, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={() => onSelect(track)}
      aria-label={track.title}
      className={`group relative aspect-square overflow-hidden rounded-[1.75rem] shadow-lg
        transition-transform duration-100 active:scale-[0.96]
        ${isCurrent ? 'ring-4 ring-white/90' : 'ring-1 ring-white/10'}`}
      style={{ backgroundColor: track.color }}
    >
      {track.cover ? (
        <img
          src={track.cover}
          alt=""
          draggable={false}
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : (
        <span className="absolute inset-0 grid place-items-center text-7xl">
          {track.emoji || '🎵'}
        </span>
      )}

      {isCurrent && (
        <span className="absolute right-3 top-3 grid h-11 w-11 place-items-center rounded-full bg-black/55 backdrop-blur-sm">
          <Equalizer playing={playing} />
        </span>
      )}

      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-3 pb-3 pt-12 text-left">
        <span className="block text-lg leading-tight font-extrabold text-white drop-shadow sm:text-xl">
          {/* Sans pochette l'emoji occupe deja le centre : inutile de le repeter. */}
          {track.cover && track.emoji ? `${track.emoji} ` : ''}
          {track.title}
        </span>
      </span>
    </button>
  )
}
