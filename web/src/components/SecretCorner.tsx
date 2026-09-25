import { useRef, useState } from 'react'

const HOLD_MS = 2500

/**
 * Acces parent : appui long dans le coin haut-droit. Invisible pour l'enfant,
 * impossible a declencher par hasard, et un anneau de progression apparait
 * pendant l'appui pour que le parent sache que ca marche.
 */
export function SecretCorner({ onUnlock }: { onUnlock: () => void }) {
  const timer = useRef<number | null>(null)
  const [holding, setHolding] = useState(false)

  const cancel = () => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    setHolding(false)
  }

  const start = () => {
    setHolding(true)
    timer.current = window.setTimeout(() => {
      cancel()
      onUnlock()
    }, HOLD_MS)
  }

  return (
    <div
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      className="fixed right-0 top-0 z-30 h-20 w-20"
      style={{ touchAction: 'none' }}
      aria-hidden
    >
      {holding && (
        <span
          className="absolute right-4 top-4 h-8 w-8 rounded-full border-2 border-white/30 border-t-white/90"
          style={{ animation: 'hold-spin 0.8s linear infinite' }}
        />
      )}
    </div>
  )
}
