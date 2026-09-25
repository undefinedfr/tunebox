import crypto from 'node:crypto'
import { ADMIN_PIN, COOKIE_SECURE, SESSION_SECRET } from './config.js'

const COOKIE = 'tunebox_admin'
const TTL_MS = 1000 * 60 * 60 * 12 // 12 h

function sign(payload) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(payload).digest('base64url')
}

export function issueToken() {
  const payload = String(Date.now() + TTL_MS)
  return `${payload}.${sign(payload)}`
}

export function verifyToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return false
  const [payload, mac] = token.split('.')
  const expected = sign(payload)
  // timingSafeEqual exige des buffers de meme longueur.
  if (mac.length !== expected.length) return false
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false
  return Number(payload) > Date.now()
}

/** Comparaison a temps constant pour ne pas fuiter le PIN caractere par caractere. */
export function checkPin(pin) {
  const a = Buffer.from(String(pin ?? ''))
  const b = Buffer.from(ADMIN_PIN)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export const COOKIE_NAME = COOKIE
export const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: COOKIE_SECURE,
  path: '/',
  maxAge: TTL_MS / 1000,
}

/** Prehandler Fastify : refuse tout ce qui n'a pas de session admin valide. */
export async function requireAdmin(request, reply) {
  if (!verifyToken(request.cookies?.[COOKIE])) {
    return reply.code(401).send({ error: 'unauthorized' })
  }
}
