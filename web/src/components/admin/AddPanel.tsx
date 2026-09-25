import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { Candidate } from '../../lib/types'
import { Alert, Card, btnGhost, btnPrimary, clock, input } from './ui'

type Draft = Candidate & { key: string; selected: boolean }
type Source = 'youtube' | 'search' | 'spotify'

function toDrafts(entries: Candidate[]): Draft[] {
  return entries.map((entry, index) => ({
    ...entry,
    key: entry.sourceId || entry.query || String(index),
    // Titre pre-nettoye cote serveur, le parent corrige ce qui reste.
    title: entry.title || entry.rawTitle || '',
    selected: true,
  }))
}

export function AddPanel({
  spotifyEnabled, onAdded,
}: { spotifyEnabled: boolean; onAdded: (count: number) => void }) {
  const [source, setSource] = useState<Source>('youtube')
  const [value, setValue] = useState('')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [heading, setHeading] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Arrivee depuis le menu "Partager" d'Android : l'URL est deja la.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const shared = params.get('url') || params.get('text') || ''
    const match = shared.match(/https?:\/\/\S+/)
    if (!match) return
    setValue(match[0])
    setSource(match[0].includes('spotify.com') ? 'spotify' : 'youtube')
    setNotice('Lien reçu depuis le partage. Vérifie le titre puis ajoute.')
    window.history.replaceState({}, '', '/admin')
  }, [])

  async function lookup() {
    const query = value.trim()
    if (!query) return
    setBusy(true)
    setError(null)
    setNotice(null)
    setDrafts([])
    try {
      if (source === 'spotify') {
        const data = await api.spotify(query)
        setHeading(data.name)
        setDrafts(toDrafts(data.items))
      } else if (source === 'search') {
        const data = await api.search(query, 8)
        setHeading(`Résultats pour « ${query} »`)
        setDrafts(toDrafts(data.results))
      } else {
        const data = await api.preview(query)
        setHeading(data.playlistTitle)
        setDrafts(toDrafts(data.entries))
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    const chosen = drafts.filter((d) => d.selected)
    if (!chosen.length) return
    setBusy(true)
    setError(null)
    try {
      const { added } = await api.addTracks(
        chosen.map((d) => ({
          title: d.title,
          subtitle: d.subtitle,
          sourceUrl: d.sourceUrl,
          sourceId: d.sourceId,
          query: d.query,
          duration: d.duration,
          thumbnail: d.thumbnail,
        }))
      )
      setDrafts([])
      setValue('')
      setHeading(null)
      setNotice(`${added} morceau${added > 1 ? 'x' : ''} en cours de téléchargement.`)
      onAdded(added)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const patch = (key: string, changes: Partial<Draft>) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, ...changes } : d)))

  const selectedCount = drafts.filter((d) => d.selected).length
  const placeholder =
    source === 'spotify'
      ? 'https://open.spotify.com/playlist/…'
      : source === 'search'
        ? 'comptine petit escargot'
        : 'https://www.youtube.com/watch?v=… ou une playlist'

  return (
    <div className="space-y-4">
      <Card>
        <div className="mb-3 flex flex-wrap gap-2">
          {([
            ['youtube', 'Lien YouTube'],
            ['search', 'Rechercher'],
            ...(spotifyEnabled ? [['spotify', 'Playlist Spotify'] as const] : []),
          ] as const).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => { setSource(key); setDrafts([]); setError(null) }}
              className={source === key ? btnPrimary : btnGhost}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            className={input}
            value={value}
            placeholder={placeholder}
            inputMode={source === 'search' ? 'text' : 'url'}
            autoCapitalize="off"
            autoCorrect="off"
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
          />
          <button type="button" className={btnPrimary} onClick={lookup} disabled={busy || !value.trim()}>
            {busy ? 'Recherche…' : 'Chercher'}
          </button>
        </div>

        <p className="mt-2 text-xs text-white/40">
          Rien n'est téléchargé à cette étape : tu vois d'abord les titres et les pochettes.
        </p>
      </Card>

      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="info">{notice}</Alert>}

      {drafts.length > 0 && (
        <Card className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="font-bold">{heading || 'Morceau trouvé'}</p>
            <button
              type="button"
              className={btnGhost}
              onClick={() => {
                const allOn = selectedCount === drafts.length
                setDrafts((list) => list.map((d) => ({ ...d, selected: !allOn })))
              }}
            >
              {selectedCount === drafts.length ? 'Tout décocher' : 'Tout cocher'}
            </button>
          </div>

          <ul className="space-y-2">
            {drafts.map((draft) => (
              <li
                key={draft.key}
                className={`flex items-start gap-3 rounded-xl border p-2.5 transition ${
                  draft.selected ? 'border-violet-400/40 bg-white/[0.06]' : 'border-white/10 opacity-55'
                }`}
              >
                <input
                  type="checkbox"
                  checked={draft.selected}
                  onChange={(e) => patch(draft.key, { selected: e.target.checked })}
                  className="mt-3 h-5 w-5 shrink-0 accent-violet-500"
                  aria-label={`Sélectionner ${draft.title}`}
                />
                {draft.thumbnail && (
                  <img
                    src={draft.thumbnail}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                )}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <input
                    className={input}
                    value={draft.title}
                    onChange={(e) => patch(draft.key, { title: e.target.value })}
                    aria-label="Titre affiché sur le bouton"
                  />
                  <p className="truncate text-xs text-white/40">
                    {draft.subtitle}
                    {draft.duration ? ` · ${clock(draft.duration)}` : ''}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          <button type="button" className={`${btnPrimary} w-full`} onClick={submit} disabled={busy || !selectedCount}>
            Ajouter {selectedCount} morceau{selectedCount > 1 ? 'x' : ''}
          </button>
        </Card>
      )}
    </div>
  )
}
