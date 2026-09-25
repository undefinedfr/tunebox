import { lazy, Suspense } from 'react'
import Kids from './Kids'
import { useRoute } from './lib/router'

// L'espace parent ne part pas dans le bundle que la tablette charge au
// demarrage. Selon le build, '@parent' est l'admin complet (web) ou le seul
// ecran de synchronisation (Android) — voir vite.config.ts.
const Parent = lazy(() => import('@parent'))

export default function App() {
  const { path, navigate } = useRoute()

  if (path.startsWith('/admin')) {
    return (
      <Suspense fallback={<div className="p-8 text-white/50">Chargement…</div>}>
        <Parent navigate={navigate} />
      </Suspense>
    )
  }
  return <Kids navigate={navigate} />
}
