type Props = { className?: string }

export const PlayIcon = ({ className = 'w-10 h-10' }: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M8 5.14v13.72a1 1 0 0 0 1.54.84l10.3-6.86a1 1 0 0 0 0-1.68L9.54 4.3A1 1 0 0 0 8 5.14Z" />
  </svg>
)

export const PauseIcon = ({ className = 'w-10 h-10' }: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <rect x="6" y="4" width="4.5" height="16" rx="1.6" />
    <rect x="13.5" y="4" width="4.5" height="16" rx="1.6" />
  </svg>
)

export const NextIcon = ({ className = 'w-8 h-8' }: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M5 5.6v12.8a1 1 0 0 0 1.55.83l9-6.4a1 1 0 0 0 0-1.66l-9-6.4A1 1 0 0 0 5 5.6Z" />
    <rect x="17" y="4.5" width="3" height="15" rx="1.4" />
  </svg>
)

export const PrevIcon = ({ className = 'w-8 h-8' }: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M19 5.6v12.8a1 1 0 0 1-1.55.83l-9-6.4a1 1 0 0 1 0-1.66l9-6.4A1 1 0 0 1 19 5.6Z" />
    <rect x="4" y="4.5" width="3" height="15" rx="1.4" />
  </svg>
)

export const NoteIcon = ({ className = 'w-8 h-8' }: Props) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
    <path d="M20 3.5 9 6v9.2A3.6 3.6 0 1 0 11 18V8.1l7-1.6v6.2a3.6 3.6 0 1 0 2 3.2V3.5Z" />
  </svg>
)
