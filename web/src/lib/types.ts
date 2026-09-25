export type Track = {
  id: string
  title: string
  subtitle: string
  duration: number | null
  audio: string | null
  cover: string | null
  color: string
  emoji: string
}

export type AdminTrack = Track & {
  position: number
  status: 'pending' | 'downloading' | 'ready' | 'error'
  error: string | null
  sourceUrl: string | null
  searchQuery: string | null
}

export type Candidate = {
  sourceId?: string
  sourceUrl?: string
  query?: string
  title: string
  rawTitle?: string
  subtitle: string
  duration: number | null
  thumbnail: string | null
}

export type QueueStatus = {
  running: boolean
  pending: number
  progress: Record<string, { stage: string; percent: number }>
  ytdlp: string | null
  spotify: boolean
}
