import { useCallback, useEffect, useState } from 'react'
import { AddPanel } from './components/admin/AddPanel'
import { TrackEditor } from './components/admin/TrackEditor'
import { TrackList } from './components/admin/TrackList'
import { Alert, Card, Modal, btnDanger, btnGhost, btnPrimary } from './components/admin/ui'
import { api } from './lib/api'
import type { AdminTrack, QueueStatus } from './lib/types'

function PinGate({ onSuccess }: { onSuccess: () => void }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(value: string) {
    setBusy(true)
    setError(null)
    try {
      await api.login(value)
      onSuccess()
    } catch (err) {
      setError((err as Error).message)
      setPin('')
    } finally {
      setBusy(false)
    }
  }

  const press = (digit: string) => {
    const next = (pin + digit).slice(0, 8)
    setPin(next)
    if (next.length >= 4) void submit(next)
  }

  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-xs space-y-5 text-center">
        <h1 className="text-2xl font-extrabold">Espace parent</h1>

        <div className="flex justify-center gap-2" aria-label="Code saisi">
          {Array.from({ length: Math.max(4, pin.length) }).map((_, i) => (
            <span
              key={i}
              className={`h-3.5 w-3.5 rounded-full ${i < pin.length ? 'bg-violet-400' : 'bg-white/15'}`}
            />
          ))}
        </div>

        {error && <Alert>{error}</Alert>}

        <div className="grid grid-cols-3 gap-2.5">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={busy}
              onClick={() => press(digit)}
              className="h-16 rounded-2xl bg-white/10 text-2xl font-bold transition active:scale-95"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin('')}
            className="h-16 rounded-2xl bg-white/5 text-sm font-bold text-white/60"
          >
            Effacer
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => press('0')}
            className="h-16 rounded-2xl bg-white/10 text-2xl font-bold transition active:scale-95"
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setPin((p) => p.slice(0, -1))}
            className="h-16 rounded-2xl bg-white/5 text-xl text-white/60"
          >
            ⌫
          </button>
        </div>

        <a href="/" className="inline-block text-sm text-white/40 underline">
          Retour à la musique
        </a>
      </div>
    </div>
  )
}

export default function Admin({ navigate }: { navigate: (to: string) => void }) {
  const [session, setSession] = useState<{ authenticated: boolean; spotify: boolean } | null>(null)
  const [tab, setTab] = useState<'add' | 'list'>('add')
  const [tracks, setTracks] = useState<AdminTrack[]>([])
  const [status, setStatus] = useState<QueueStatus | null>(null)
  const [editing, setEditing] = useState<AdminTrack | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<AdminTrack | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.session().then(setSession).catch(() => setSession({ authenticated: false, spotify: false }))
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [list, queue] = await Promise.all([api.tracks(), api.status()])
      setTracks(list.tracks)
      setStatus(queue)
    } catch (err) {
      setError((err as Error).message)
    }
  }, [])

  useEffect(() => {
    if (!session?.authenticated) return
    refresh()
  }, [session?.authenticated, refresh])

  // On ne sonde que tant qu'un import est en cours : inutile de marteler le NAS.
  const busy = tracks.some((t) => t.status === 'pending' || t.status === 'downloading')
  useEffect(() => {
    if (!session?.authenticated || !busy) return
    const timer = window.setInterval(refresh, 2000)
    return () => window.clearInterval(timer)
  }, [session?.authenticated, busy, refresh])

  if (!session) return <div className="p-8 text-white/50">Chargement…</div>
  if (!session.authenticated) {
    return <PinGate onSuccess={() => setSession({ ...session, authenticated: true })} />
  }

  async function move(id: string, delta: number) {
    const index = tracks.findIndex((t) => t.id === id)
    const target = index + delta
    if (index < 0 || target < 0 || target >= tracks.length) return
    const next = [...tracks]
    ;[next[index], next[target]] = [next[target], next[index]]
    setTracks(next) // optimiste : le NAS confirme juste apres
    try {
      const { tracks: saved } = await api.reorder(next.map((t) => t.id))
      setTracks(saved)
    } catch (err) {
      setError((err as Error).message)
      refresh()
    }
  }

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl px-4 pb-16 pt-[calc(1rem+env(safe-area-inset-top))]">
      <header className="mb-5 flex items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold">Espace parent</h1>
        <div className="flex gap-2">
          <button type="button" className={btnGhost} onClick={() => navigate('/')}>
            Fermer
          </button>
          <button
            type="button"
            className={btnGhost}
            onClick={async () => {
              await api.logout().catch(() => {})
              navigate('/')
            }}
          >
            Verrouiller
          </button>
        </div>
      </header>

      <div className="mb-4 flex gap-2">
        <button type="button" className={tab === 'add' ? btnPrimary : btnGhost} onClick={() => setTab('add')}>
          Ajouter
        </button>
        <button type="button" className={tab === 'list' ? btnPrimary : btnGhost} onClick={() => setTab('list')}>
          Morceaux ({tracks.length})
        </button>
      </div>

      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      {tab === 'add' ? (
        <AddPanel
          spotifyEnabled={session.spotify}
          onAdded={() => {
            setTab('list')
            refresh()
          }}
        />
      ) : (
        <TrackList
          tracks={tracks}
          status={status}
          onEdit={setEditing}
          onMove={move}
          onRetry={async (id) => {
            await api.retry(id).catch((err) => setError((err as Error).message))
            refresh()
          }}
          onDelete={setConfirmDelete}
        />
      )}

      {status?.ytdlp === null && (
        <div className="mt-6">
          <Alert>yt-dlp est introuvable sur le serveur : aucun import ne pourra aboutir.</Alert>
        </div>
      )}

      {tab === 'list' && tracks.length > 0 && (
        <Card className="mt-6">
          <p className="text-xs text-white/40">
            L'ordre de cette liste est celui des boutons sur la tablette. La tablette se met à jour
            toute seule à la prochaine ouverture de l'app.
          </p>
        </Card>
      )}

      {editing && (
        <TrackEditor
          track={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setTracks((list) => list.map((t) => (t.id === updated.id ? updated : t)))
            setEditing(updated)
          }}
        />
      )}

      {confirmDelete && (
        <Modal title="Supprimer ce morceau ?" onClose={() => setConfirmDelete(null)}>
          <p className="mb-5 text-white/70">
            « {confirmDelete.title} » sera retiré de la tablette et son fichier audio supprimé du NAS.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={`${btnDanger} flex-1`}
              onClick={async () => {
                const target = confirmDelete
                setConfirmDelete(null)
                try {
                  await api.remove(target.id)
                  setTracks((list) => list.filter((t) => t.id !== target.id))
                } catch (err) {
                  setError((err as Error).message)
                }
              }}
            >
              Supprimer
            </button>
            <button type="button" className={`${btnGhost} flex-1`} onClick={() => setConfirmDelete(null)}>
              Annuler
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
