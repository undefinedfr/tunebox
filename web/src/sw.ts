/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core'
import { CacheableResponsePlugin } from 'workbox-cacheable-response'
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching'
import { RangeRequestsPlugin } from 'workbox-range-requests'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import { API_CACHE, AUDIO_CACHE, COVER_CACHE } from './lib/caches'

declare let self: ServiceWorkerGlobalScope

self.skipWaiting()
clientsClaim()

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

// Toute navigation rend index.html : '/' comme '/admin', y compris quand
// Android ouvre l'app via le menu "Partager".
registerRoute(
  new NavigationRoute(createHandlerBoundToURL('index.html'), {
    denylist: [/^\/api\//, /^\/media\//, /^\/covers\//],
  })
)

/**
 * L'element <audio> demande des plages d'octets. Sans RangeRequestsPlugin, une
 * reponse 200 complete sortie du cache ne satisfait pas une requete Range et la
 * lecture hors ligne echoue silencieusement.
 */
registerRoute(
  ({ url }) => url.pathname.startsWith('/media/'),
  new CacheFirst({
    cacheName: AUDIO_CACHE,
    plugins: [new CacheableResponsePlugin({ statuses: [200] }), new RangeRequestsPlugin()],
  })
)

registerRoute(
  ({ url }) => url.pathname.startsWith('/covers/'),
  new CacheFirst({
    cacheName: COVER_CACHE,
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  })
)

// Seul le catalogue est mis en cache : les routes /api/admin/* doivent toujours
// toucher le serveur.
registerRoute(
  ({ url }) => url.pathname === '/api/catalog',
  new NetworkFirst({
    cacheName: API_CACHE,
    networkTimeoutSeconds: 4,
    plugins: [new CacheableResponsePlugin({ statuses: [200] })],
  })
)
