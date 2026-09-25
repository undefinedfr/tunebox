import { useRef, useState } from 'react'
import { api } from '../../lib/api'
import type { AdminTrack } from '../../lib/types'
import { Alert, EMOJIS, Modal, PALETTE, btnGhost, btnPrimary, input } from './ui'

type Props = {
  track: AdminTrack
  onClose: () => void
  onSaved: (track: AdminTrack) => void
}

export function TrackEditor({ track, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(track.title)
  const [subtitle, setSubtitle] = useState(track.subtitle)
  const [emoji, setEmoji] = useState(track.emoji)
  const [color, setColor] = useState(track.color)
  const [coverUrl, setCoverUrl] = useState('')
  const [cover, setCover] = useState(track.cover)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function guard(action: () => Promise<AdminTrack>) {
    setBusy(true)
    setError(null)
    try {
      const updated = await action()
      setCover(updated.cover)
      onSaved(updated)
      return updated
    } catch (err) {
      setError((err as Error).message)
      return null
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    const updated = await guard(() =>
      api.updateTrack(track.id, { title, subtitle, emoji, color }).then((r) => r.track)
    )
    if (updated) onClose()
  }

  return (
    <Modal title="Modifier le bouton" onClose={onClose}>
      <div className="space-y-5">
        {error && <Alert>{error}</Alert>}

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            aria-label="Choisir une image"
            className="grid h-24 w-24 shrink-0 place-items-center overflow-hidden rounded-2xl ring-1 ring-white/15 transition active:scale-95"
            style={{ backgroundColor: color }}
          >
            {cover ? (
              <img src={cover} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="text-4xl">{emoji || '🎵'}</span>
            )}
          </button>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-white/40">Pochette</p>
            <button
              type="button"
              className={`${btnGhost} w-full`}
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              Choisir une image
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) guard(() => api.uploadCover(track.id, file).then((r) => r.track))
                e.target.value = ''
              }}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={input}
            placeholder="…ou coller une adresse d'image"
            value={coverUrl}
            inputMode="url"
            autoCapitalize="off"
            onChange={(e) => setCoverUrl(e.target.value)}
          />
          <button
            type="button"
            className={btnGhost}
            disabled={busy || !coverUrl.trim()}
            onClick={async () => {
              const ok = await guard(() => api.setCoverUrl(track.id, coverUrl.trim()).then((r) => r.track))
              if (ok) setCoverUrl('')
            }}
          >
            Utiliser
          </button>
        </div>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-white/40">
            Titre affiché sur le bouton
          </span>
          <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>

        <label className="block space-y-1.5">
          <span className="text-xs font-bold uppercase tracking-wide text-white/40">
            Artiste (affiché dans le lecteur)
          </span>
          <input className={input} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} />
        </label>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-white/40">
            Emoji — utilisé si le bouton n'a pas de pochette
          </p>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setEmoji('')}
              className={`grid h-11 w-11 place-items-center rounded-xl text-xs ${
                emoji === '' ? 'bg-violet-500 text-white' : 'bg-white/10 text-white/60'
              }`}
            >
              aucun
            </button>
            {EMOJIS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setEmoji(item)}
                className={`grid h-11 w-11 place-items-center rounded-xl text-2xl ${
                  emoji === item ? 'bg-violet-500' : 'bg-white/10'
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-white/40">Couleur de fond</p>
          <div className="flex flex-wrap gap-2">
            {PALETTE.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setColor(item)}
                aria-label={`Couleur ${item}`}
                className={`h-11 w-11 rounded-xl ring-offset-2 ring-offset-ink-800 ${
                  color === item ? 'ring-2 ring-white' : ''
                }`}
                style={{ backgroundColor: item }}
              />
            ))}
          </div>
        </div>

        <button type="button" className={`${btnPrimary} w-full`} onClick={save} disabled={busy || !title.trim()}>
          Enregistrer
        </button>
      </div>
    </Modal>
  )
}
