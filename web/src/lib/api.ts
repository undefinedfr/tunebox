import type { AdminTrack, Candidate, QueueStatus, Track } from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: 'same-origin',
    ...init,
    headers:
      init?.body && !(init.body instanceof FormData)
        ? { 'Content-Type': 'application/json', ...init?.headers }
        : init?.headers,
  })
  if (!res.ok) {
    const message = await res
      .json()
      .then((d) => d.error)
      .catch(() => null)
    throw new Error(message || `Erreur ${res.status}`)
  }
  return res.json() as Promise<T>
}

const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body) })

export const api = {
  catalog: () => request<{ version: number; tracks: Track[] }>('/api/catalog'),

  session: () => request<{ authenticated: boolean; spotify: boolean }>('/api/admin/session'),
  login: (pin: string) => request<{ ok: true }>('/api/admin/login', json({ pin })),
  logout: () => request<{ ok: true }>('/api/admin/logout', { method: 'POST' }),

  status: () => request<QueueStatus>('/api/admin/status'),
  tracks: () => request<{ tracks: AdminTrack[] }>('/api/admin/tracks'),

  preview: (url: string) =>
    request<{ kind: string; playlistTitle: string | null; entries: Candidate[] }>(
      '/api/admin/preview',
      json({ url })
    ),
  search: (query: string, limit = 6) =>
    request<{ results: Candidate[] }>('/api/admin/search', json({ query, limit })),
  spotify: (url: string) =>
    request<{ name: string; items: Candidate[] }>('/api/admin/spotify', json({ url })),

  addTracks: (items: unknown[]) =>
    request<{ added: number; ids: string[] }>('/api/admin/tracks', json({ items })),
  updateTrack: (id: string, patch: Partial<Pick<Track, 'title' | 'subtitle' | 'color' | 'emoji'>>) =>
    request<{ track: AdminTrack }>(`/api/admin/tracks/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    }),
  setCoverUrl: (id: string, url: string) =>
    request<{ track: AdminTrack }>(`/api/admin/tracks/${id}/cover`, json({ url })),
  uploadCover: (id: string, file: File) => {
    const form = new FormData()
    form.append('cover', file)
    return request<{ track: AdminTrack }>(`/api/admin/tracks/${id}/cover`, {
      method: 'POST',
      body: form,
    })
  },
  retry: (id: string) => request<{ ok: true }>(`/api/admin/tracks/${id}/retry`, { method: 'POST' }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/admin/tracks/${id}`, { method: 'DELETE' }),
  reorder: (ids: string[]) => request<{ tracks: AdminTrack[] }>('/api/admin/reorder', json({ ids })),
}
