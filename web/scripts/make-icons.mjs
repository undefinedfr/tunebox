// Genere les icones PWA sans dependance : rendu 4x puis moyenne (anti-aliasing),
// encodage PNG via zlib. Evite d'embarquer sharp/canvas juste pour ca.
import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { crc32 } from 'node:zlib'

const SS = 4 // supersampling

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body) >>> 0)
  return Buffer.concat([len, body, crc])
}

function encodePng(width, height, rgba) {
  const stride = width * 4
  const raw = Buffer.alloc((stride + 1) * height)
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0 // filtre None
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8    // bits par canal
  ihdr[9] = 6    // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const mix = (a, b, t) => Math.round(a + (b - a) * t)

function draw(size, { inset, noteOnly = false }) {
  const S = size * SS
  const buf = Buffer.alloc(S * S * 4)
  const pad = S * inset
  const radius = (S - 2 * pad) * 0.24
  const cx = S / 2

  const inRounded = (x, y) => {
    const lo = pad, hi = S - pad
    if (x < lo || x > hi || y < lo || y > hi) return false
    const dx = Math.max(lo + radius - x, 0, x - (hi - radius))
    const dy = Math.max(lo + radius - y, 0, y - (hi - radius))
    return dx * dx + dy * dy <= radius * radius
  }

  // Note de musique : deux tetes + hampes + barre de liaison.
  const headR = (S - 2 * pad) * 0.135
  const headY = S * 0.645
  const leftX = cx - (S - 2 * pad) * 0.16
  const rightX = cx + (S - 2 * pad) * 0.20
  const stemW = (S - 2 * pad) * 0.055
  const stemTop = S * 0.305
  const beamH = (S - 2 * pad) * 0.10

  const inNote = (x, y) => {
    for (const hx of [leftX, rightX]) {
      const dx = (x - hx) / (headR * 1.18)
      const dy = (y - headY) / headR
      if (dx * dx + dy * dy <= 1) return true
    }
    if (y >= stemTop && y <= headY) {
      if (Math.abs(x - (leftX + headR * 1.18 - stemW / 2)) <= stemW / 2) return true
      if (Math.abs(x - (rightX + headR * 1.18 - stemW / 2)) <= stemW / 2) return true
    }
    if (y >= stemTop && y <= stemTop + beamH) {
      const a = leftX + headR * 1.18 - stemW
      const b = rightX + headR * 1.18
      if (x >= a && x <= b) return true
    }
    return false
  }

  for (let y = 0; y < S; y++) {
    const t = y / S
    const r = mix(0x7c, 0xec, t), g = mix(0x3a, 0x48, t), b = mix(0xed, 0x99, t)
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      const note = inNote(x, y)
      // Le calque avant d'une icone adaptative Android est dessine par-dessus
      // un fond fourni par le systeme : seule la note doit etre opaque.
      if (noteOnly) {
        if (!note) continue
        buf[i] = buf[i + 1] = buf[i + 2] = buf[i + 3] = 255
        continue
      }
      if (!inRounded(x, y)) continue
      buf[i] = note ? 255 : r
      buf[i + 1] = note ? 255 : g
      buf[i + 2] = note ? 255 : b
      buf[i + 3] = 255
    }
  }

  // Downsample SSxSS -> 1 pixel.
  const out = Buffer.alloc(size * size * 4)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let acc = [0, 0, 0, 0]
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const i = ((y * SS + sy) * S + (x * SS + sx)) * 4
          const a = buf[i + 3] / 255
          acc[0] += buf[i] * a; acc[1] += buf[i + 1] * a; acc[2] += buf[i + 2] * a; acc[3] += a
        }
      }
      const n = SS * SS
      const o = (y * size + x) * 4
      const alpha = acc[3] / n
      out[o] = alpha ? Math.round(acc[0] / acc[3]) : 0
      out[o + 1] = alpha ? Math.round(acc[1] / acc[3]) : 0
      out[o + 2] = alpha ? Math.round(acc[2] / acc[3]) : 0
      out[o + 3] = Math.round(alpha * 255)
    }
  }
  return encodePng(size, size, out)
}

mkdirSync('public/icons', { recursive: true })
const targets = [
  ['icons/icon-192.png', 192, 0.02],
  ['icons/icon-512.png', 512, 0.02],
  // Maskable : Android rogne jusqu'a 20% sur chaque bord, on garde le motif au centre.
  ['icons/maskable-512.png', 512, 0.14],
  ['icons/apple-touch-icon.png', 180, 0.0],
]
for (const [file, size, inset] of targets) {
  writeFileSync(`public/${file}`, draw(size, { inset }))
  console.log('ecrit public/' + file)
}

// --- Icones de l'app Android -------------------------------------------------
// `node scripts/make-icons.mjs --android` regenere aussi les mipmaps du projet
// Capacitor. Separe du reste : le build web n'a pas besoin du dossier android/,
// qui n'existe pas tant que `npx cap add android` n'a pas tourne.
if (process.argv.includes('--android')) {
  const res = 'android/app/src/main/res'
  if (!existsSync(res)) {
    console.error(`${res} introuvable — lance d'abord \`npx cap add android\``)
    process.exit(1)
  }

  // 48 dp pour l'icone classique, 108 dp pour le calque avant adaptatif.
  const densities = [
    ['mdpi', 1],
    ['hdpi', 1.5],
    ['xhdpi', 2],
    ['xxhdpi', 3],
    ['xxxhdpi', 4],
  ]

  for (const [density, scale] of densities) {
    const dir = `${res}/mipmap-${density}`
    mkdirSync(dir, { recursive: true })
    const legacy = draw(Math.round(48 * scale), { inset: 0.02 })
    writeFileSync(`${dir}/ic_launcher.png`, legacy)
    writeFileSync(`${dir}/ic_launcher_round.png`, legacy)
    // Zone sure d'une icone adaptative : le disque central de 66 dp sur 108.
    writeFileSync(
      `${dir}/ic_launcher_foreground.png`,
      draw(Math.round(108 * scale), { inset: 0.26, noteOnly: true })
    )
    console.log(`ecrit ${dir}/`)
  }
}
