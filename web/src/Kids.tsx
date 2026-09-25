import { PlayerBar } from './components/PlayerBar'
import { SecretCorner } from './components/SecretCorner'
import { TrackTile } from './components/TrackTile'
import { NoteIcon } from './components/Icons'
import { useCatalog } from '@catalog'
import { useKeepAwake } from '@platform'
import { usePlayer } from './lib/player'

export default function Kids({ navigate }: { navigate: (to: string) => void }) {
  const { tracks, status } = useCatalog()
  const player = usePlayer(tracks)

  // Sans effet dans un navigateur ; garde l'ecran allume dans l'app Android,
  // ou un WebView en arriere-plan coupe la lecture.
  useKeepAwake(player.playing)

  return (
    <div className="min-h-full bg-ink-800">
      <SecretCorner onUnlock={() => navigate('/admin')} />

      {status === 'loading' && tracks.length === 0 && (
        <div className="grid min-h-screen place-items-center text-white/40">
          <NoteIcon className="h-16 w-16 animate-pulse" />
        </div>
      )}

      {/* Un catalogue vide et un serveur injoignable ne sont pas la meme
          situation : les confondre envoie le parent chercher au mauvais
          endroit. */}
      {status === 'error' && tracks.length === 0 && (
        <div className="grid min-h-screen place-items-center px-8 text-center">
          <div>
            <p className="text-5xl">📡</p>
            <p className="mt-6 text-2xl font-extrabold">Serveur injoignable</p>
            <p className="mt-2 text-white/50">
              Vérifie que la tablette est sur le réseau et que le serveur est allumé.
              La musique revient toute seule ensuite.
            </p>
          </div>
        </div>
      )}

      {status === 'ready' && tracks.length === 0 && (
        <div className="grid min-h-screen place-items-center px-8 text-center">
          <div>
            <NoteIcon className="mx-auto h-16 w-16 text-white/25" />
            <p className="mt-6 text-2xl font-extrabold">Aucune musique pour l'instant</p>
            <p className="mt-2 text-white/50">
              Appui long de 2 secondes dans le coin en haut à droite pour ouvrir l'espace parent.
            </p>
          </div>
        </div>
      )}

      {tracks.length > 0 && (
        <div
          className="grid gap-3 p-3 sm:gap-4 sm:p-4
            grid-cols-2 min-[560px]:grid-cols-3 min-[900px]:grid-cols-4 min-[1280px]:grid-cols-5"
          style={{
            // L'app Android s'affiche bord a bord, barres systeme masquees : sans
            // ca, la premiere rangee passerait sous une encoche de camera.
            paddingTop: 'calc(0.75rem + env(safe-area-inset-top))',
            // De quoi scroller sous le lecteur sans jamais cacher la derniere rangee.
            paddingBottom: player.current ? 'calc(7rem + env(safe-area-inset-bottom))' : undefined,
          }}
        >
          {tracks.map((track) => (
            <TrackTile
              key={track.id}
              track={track}
              isCurrent={track.id === player.currentId}
              playing={player.playing}
              onSelect={player.select}
            />
          ))}
        </div>
      )}

      {player.current && (
        <PlayerBar
          track={player.current}
          playing={player.playing}
          position={player.position}
          duration={player.duration}
          onToggle={player.toggle}
          onNext={player.next}
          onPrevious={player.previous}
          onSeek={player.seek}
        />
      )}
    </div>
  )
}
