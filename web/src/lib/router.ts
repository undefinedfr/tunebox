import { useEffect, useState } from 'react'

/** Routeur minimal : deux ecrans, aucune raison d'embarquer une dependance. */
export function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = (to: string) => {
    window.history.pushState({}, '', to)
    setPath(new URL(to, location.origin).pathname)
  }

  return { path, navigate }
}
