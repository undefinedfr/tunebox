import fs from 'node:fs'
import path from 'node:path'
import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import fastifyStatic from '@fastify/static'
import { COVERS_DIR, MEDIA_DIR, PORT, SESSION_SECRET, WEB_DIST } from './lib/config.js'
import { resumeInterrupted } from './lib/ingest.js'
import { ytdlpVersion } from './lib/ytdlp.js'
import adminRoutes from './routes/admin.js'
import catalogRoutes from './routes/catalog.js'

const app = Fastify({
  logger: { transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' } },
  bodyLimit: 15 * 1024 * 1024,
})

await app.register(cookie, { secret: SESSION_SECRET })
await app.register(multipart, { limits: { fileSize: 12 * 1024 * 1024, files: 1 } })

// Les audios et les pochettes. @fastify/static gere les requetes Range, ce dont
// l'element <audio> a besoin pour se positionner dans un morceau.
await app.register(fastifyStatic, {
  root: MEDIA_DIR,
  prefix: '/media/',
  decorateReply: false,
  cacheControl: true,
  maxAge: '365d',
  immutable: true,
})
await app.register(fastifyStatic, {
  root: COVERS_DIR,
  prefix: '/covers/',
  decorateReply: false,
  cacheControl: true,
  // Chaque remplacement produit un nouveau nom de fichier, donc rien a
  // invalider : on peut mettre en cache aussi longtemps que l'audio.
  maxAge: '365d',
  immutable: true,
})

await app.register(catalogRoutes)
await app.register(adminRoutes)

app.get('/api/health', async () => ({ ok: true, ytdlp: await ytdlpVersion() }))


// L'interface buildee. Absente en dev : Vite la sert lui-meme sur son port.
const hasWeb = fs.existsSync(path.join(WEB_DIST, 'index.html'))
if (hasWeb) {
  await app.register(fastifyStatic, {
    root: WEB_DIST,
    prefix: '/',
    decorateReply: false,
    index: ['index.html'],
    maxAge: '5m',
  })

  // SPA : toute route inconnue rend index.html, sauf l'API.
  app.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith('/api/')) return reply.code(404).send({ error: 'not found' })
    return reply
      .type('text/html')
      .header('Cache-Control', 'no-cache')
      .send(fs.createReadStream(path.join(WEB_DIST, 'index.html')))
  })
}

const resumed = resumeInterrupted()
if (resumed) app.log.info(`${resumed} import(s) repris apres redemarrage`)
if (!hasWeb) app.log.warn('web/dist absent — lance `npm --prefix web run dev` a cote.')

await app.listen({ port: PORT, host: '0.0.0.0' })
