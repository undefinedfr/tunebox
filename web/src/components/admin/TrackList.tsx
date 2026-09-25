import type { AdminTrack, QueueStatus } from '../../lib/types'
import { Card, btnDanger, btnGhost, clock } from './ui'

type Props = {
  tracks: AdminTrack[]
  status: QueueStatus | null
  onEdit: (track: AdminTrack) => void
  onMove: (id: string, delta: number) => void
  onRetry: (id: string) => void
  onDelete: (track: AdminTrack) => void
}

function StatusBadge({ track, status }: { track: AdminTrack; status: QueueStatus | null }) {
  if (track.status === 'ready') {
    return <span className="text-xs text-emerald-300/80">Prêt · {clock(track.duration)}</span>
  }
  if (track.status === 'error') {
    return <span className="text-xs text-red-300">Échec : {track.error}</span>
  }
  const job = status?.progress?.[track.id]
  const label =
    job?.stage === 'search'
      ? 'Recherche de la source…'
      : job?.stage === 'cover'
        ? 'Pochette…'
        : job?.percent
          ? `Téléchargement ${Math.round(job.percent)} %`
          : 'En file d’attente…'
  return <span className="text-xs text-amber-300/90">{label}</span>
}

export function TrackList({ tracks, status, onEdit, onMove, onRetry, onDelete }: Props) {
  if (!tracks.length) {
    return (
      <Card>
        <p className="text-white/50">
          Aucun morceau pour l'instant. Passe par l'onglet <strong>Ajouter</strong>.
        </p>
      </Card>
    )
  }

  return (
    <ul className="space-y-2">
      {tracks.map((track, index) => (
        <li
          key={track.id}
          className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-700 p-2.5"
        >
          {/* La vignette est le chemin le plus naturel vers le choix de la
              pochette : on la rend cliquable et on l'annonce. */}
          <button
            type="button"
            onClick={() => onEdit(track)}
            aria-label={`Changer la pochette de ${track.title}`}
            className="relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl ring-1 ring-white/15 transition active:scale-95"
            style={{ backgroundColor: track.color }}
          >
            {track.cover ? (
              <img src={track.cover} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="text-2xl">{track.emoji || '🎵'}</span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-black/65 py-[1px] text-center text-[10px] leading-tight">
              ✏️
            </span>
          </button>

          <button type="button" onClick={() => onEdit(track)} className="min-w-0 flex-1 text-left">
            <p className="truncate font-bold">{track.title}</p>
            <StatusBadge track={track} status={status} />
          </button>

          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              className={`${btnGhost} px-2.5`}
              disabled={index === 0}
              onClick={() => onMove(track.id, -1)}
              aria-label="Monter"
            >
              ↑
            </button>
            <button
              type="button"
              className={`${btnGhost} px-2.5`}
              disabled={index === tracks.length - 1}
              onClick={() => onMove(track.id, 1)}
              aria-label="Descendre"
            >
              ↓
            </button>
            <button type="button" className={btnGhost} onClick={() => onEdit(track)}>
              Modifier
            </button>
            {track.status === 'error' && (
              <button type="button" className={btnGhost} onClick={() => onRetry(track.id)}>
                Réessayer
              </button>
            )}
            <button
              type="button"
              className={`${btnDanger} px-2.5`}
              onClick={() => onDelete(track)}
              aria-label={`Supprimer ${track.title}`}
            >
              ✕
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
