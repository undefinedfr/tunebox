import { useCallback, useEffect, useState } from 'react'
import { Alert, Card, btnDanger, btnGhost, btnPrimary, input } from '../components/admin/ui'
import { getSetting, readTracks } from './db'
import { COVERS_DIR, MEDIA_DIR, totalBytes, wipe } from './fs'
import { replaceTracks } from './db'
import { SyncError, sync, type SyncProgress, type SyncResult } from './sync'

function megabytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(bytes < 100 * 1024 * 1024 ? 1 : 0)} Mo`
}

function when(timestamp: number | null) {
  if (!timestamp) return 'jamais'
  return new Date(timestamp).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

type Local = { tracks: number; bytes: number; syncedAt: number | null }

/**
 * Ecran parent de la version Android. Il n'y a rien a ajouter ici : l'app ne
 * telecharge pas depuis YouTube, elle recopie un catalogue prepare sur le
 * serveur de la maison. Une fois la copie faite, le serveur peut rester
 * eteint pour toujours.
 */
export default function Sync({ navigate }: { navigate: (to: string) => void }) {
  const [server, setServer] = useState('')
  const [local, setLocal] = useState<Local>({ tracks: 0, bytes: 0, syncedAt: null })
  const [progress, setProgress] = useState<SyncProgress | null>(null)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmWipe, setConfirmWipe] = useState(false)

  const reload = useCallback(async () => {
    const [rows, media, covers, url, syncedAt] = await Promise.all([
      readTracks(),
      totalBytes(MEDIA_DIR),
      totalBytes(COVERS_DIR),
      getSetting('server_url'),
      getSetting('synced_at'),
    ])
    setLocal({ tracks: rows.length, bytes: media + covers, syncedAt: syncedAt ? Number(syncedAt) : null })
    setServer((current) => current || url || '')
  }, [])

  useEffect(() => {
    reload().catch(() => setError('Base locale illisible'))
  }, [reload])

  async function run() {
    setError(null)
    setResult(null)
    setProgress({ done: 0, total: 0, label: 'Connexion…', phase: 'catalog' })
    try {
      setResult(await sync(server, setProgress))
      await reload()
    } catch (err) {
      setError(err instanceof SyncError ? err.message : (err as Error).message)
    } finally {
      setProgress(null)
    }
  }

  async function erase() {
    setConfirmWipe(false)
    setError(null)
    setResult(null)
    try {
      await replaceTracks([])
      await wipe()
      await reload()
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const busy = progress !== null
  const percent = progress?.total ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="min-h-screen p-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(1rem+env(safe-area-inset-bottom))]">
      <header className="mb-5 flex items-center justify-between gap-4">
        <h1 className="text-xl font-extrabold">Espace parent</h1>
        <button type="button" className={btnGhost} onClick={() => navigate('/')} disabled={busy}>
          Retour à la musique
        </button>
      </header>

      <div className="mx-auto max-w-lg space-y-4">
        <Card className="space-y-3">
          <div className="flex items-baseline justify-between gap-4">
            <p className="text-3xl font-extrabold">{local.tracks}</p>
            <p className="text-sm text-white/50">
              {local.tracks > 1 ? 'morceaux sur la tablette' : 'morceau sur la tablette'}
            </p>
          </div>
          <dl className="space-y-1 text-sm text-white/50">
            <div className="flex justify-between gap-4">
              <dt>Espace occupé</dt>
              <dd className="text-white/70">{megabytes(local.bytes)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt>Dernière synchronisation</dt>
              <dd className="text-white/70">{when(local.syncedAt)}</dd>
            </div>
          </dl>
        </Card>

        <Card className="space-y-3">
          <div>
            <label htmlFor="server" className="text-sm font-bold">
              Adresse du serveur
            </label>
            <p className="mt-1 text-sm text-white/45">
              Celle que tu utilises dans le navigateur, par exemple
              {' '}
              <code className="text-white/60">192.168.1.20:8080</code>. Elle ne sert qu'au moment
              de la copie.
            </p>
          </div>
          <input
            id="server"
            className={input}
            value={server}
            onChange={(event) => setServer(event.target.value)}
            placeholder="192.168.1.20:8080"
            inputMode="url"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={busy}
          />

          <button type="button" className={btnPrimary} onClick={run} disabled={busy || !server.trim()}>
            {busy ? 'Copie en cours…' : local.tracks ? 'Mettre à jour' : 'Copier la musique'}
          </button>

          {progress && (
            <div className="space-y-2">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-pink-500 transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="truncate text-sm text-white/50">
                {progress.total ? `${progress.done}/${progress.total} — ` : ''}
                {progress.label}
              </p>
            </div>
          )}

          {error && <Alert>{error}</Alert>}

          {result && (
            <Alert kind="info">
              {result.tracks} morceaux prêts, dont {result.downloaded} fichier
              {result.downloaded > 1 ? 's' : ''} téléchargé{result.downloaded > 1 ? 's' : ''}.
              {result.failed.length > 0 && (
                <>
                  {' '}
                  {result.failed.length} morceau{result.failed.length > 1 ? 'x' : ''} ignoré
                  {result.failed.length > 1 ? 's' : ''} : {result.failed.join(', ')}.
                </>
              )}
            </Alert>
          )}
        </Card>

        <Card className="space-y-3">
          <p className="text-sm text-white/45">
            Tout est stocké dans l'application. La désinstaller efface la musique.
          </p>
          {confirmWipe ? (
            <div className="flex gap-2">
              <button type="button" className={btnDanger} onClick={erase}>
                Oui, tout effacer
              </button>
              <button type="button" className={btnGhost} onClick={() => setConfirmWipe(false)}>
                Annuler
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={btnDanger}
              onClick={() => setConfirmWipe(true)}
              disabled={busy || local.tracks === 0}
            >
              Effacer la musique de la tablette
            </button>
          )}
        </Card>
      </div>
    </div>
  )
}
