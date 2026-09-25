import type { ReactNode } from 'react'

export const btn =
  'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold ' +
  'transition active:scale-95 disabled:pointer-events-none disabled:opacity-40'
export const btnPrimary = `${btn} bg-gradient-to-br from-violet-500 to-pink-500 text-white shadow`
export const btnGhost = `${btn} bg-white/10 text-white hover:bg-white/15`
export const btnDanger = `${btn} bg-red-500/15 text-red-300 hover:bg-red-500/25`
export const input =
  'w-full rounded-xl border border-white/10 bg-ink-900 px-3.5 py-2.5 text-[15px] text-white ' +
  'placeholder:text-white/30 outline-none focus:border-violet-400/60'

export const PALETTE = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#06b6d4', '#ef4444', '#8b5cf6', '#84cc16',
]

export const EMOJIS = [
  '🎵', '🎶', '🦈', '🐻', '🐰', '🦁', '🐸', '🦄',
  '🚂', '🚀', '⭐', '🌈', '🌙', '☀️', '🍭', '🎂',
  '🎈', '🎄', '❄️', '🌸', '🐧', '🐝', '🚗', '⛵',
]

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-ink-700 p-4 ${className}`}>{children}</div>
  )
}

export function Alert({ kind = 'error', children }: { kind?: 'error' | 'info'; children: ReactNode }) {
  const tone =
    kind === 'error'
      ? 'border-red-500/30 bg-red-500/10 text-red-200'
      : 'border-sky-500/30 bg-sky-500/10 text-sky-200'
  return <div className={`rounded-xl border px-3.5 py-2.5 text-sm ${tone}`}>{children}</div>
}

export function Modal({
  title, onClose, children,
}: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-800 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-4">
          <h2 className="text-lg font-extrabold">{title}</h2>
          <button type="button" onClick={onClose} className={btnGhost} aria-label="Fermer">
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function clock(seconds: number | null) {
  if (!seconds || !Number.isFinite(seconds)) return ''
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}
