// Derive toutes les icones de l'app depuis un seul fichier source.
//
//   node scripts/make-icons.mjs             icones web (public/icons)
//   node scripts/make-icons.mjs --android   + mipmaps du projet Capacitor
//
// Sans dependance : decodage et encodage PNG a la main par-dessus node:zlib.
// Embarquer sharp ou canvas pour redimensionner quatre images qui changent une
// fois par an coutait plus cher que ces deux cents lignes — et ca evite une
// compilation native dans l'image Docker.
import { deflateSync, inflateSync, crc32 } from 'node:zlib'
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'

const SOURCE = 'brand/tunebox-icon.png'

// ---------------------------------------------------------------- encodage

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
  ihdr[8] = 8 // bits par canal
  ihdr[9] = 6 // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------------------------------------------------------- decodage

const CHANNELS = { 0: 1, 2: 3, 4: 2, 6: 4 }

function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error('ce fichier n’est pas un PNG')

  let header = null
  const parts = []
  for (let offset = 8; offset < buffer.length; ) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      header = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        depth: data[8],
        color: data[9],
        interlace: data[12],
      }
    } else if (type === 'IDAT') parts.push(data)
    else if (type === 'IEND') break
    offset += 12 + length
  }

  const bpp = CHANNELS[header.color]
  if (header.depth !== 8 || !bpp || header.interlace !== 0) {
    throw new Error(
      `PNG non supporte (profondeur ${header.depth}, type ${header.color}, entrelacement ${header.interlace}). ` +
        'Reexporte la source en PNG 8 bits non entrelace.'
    )
  }

  // Defiltrage. Chaque ligne commence par son numero de filtre et se
  // reconstruit a partir du pixel de gauche et de la ligne precedente.
  const raw = inflateSync(Buffer.concat(parts))
  const stride = header.width * bpp
  const planes = Buffer.alloc(header.height * stride)
  let read = 0
  for (let y = 0; y < header.height; y++) {
    const filter = raw[read++]
    const line = raw.subarray(read, read + stride)
    read += stride
    const cur = planes.subarray(y * stride, (y + 1) * stride)
    const prev = y ? planes.subarray((y - 1) * stride, y * stride) : null
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? cur[i - bpp] : 0
      const b = prev ? prev[i] : 0
      const c = prev && i >= bpp ? prev[i - bpp] : 0
      let value = line[i]
      if (filter === 1) value += a
      else if (filter === 2) value += b
      else if (filter === 3) value += (a + b) >> 1
      else if (filter === 4) {
        const pa = Math.abs(b - c)
        const pb = Math.abs(a - c)
        const pc = Math.abs(a + b - 2 * c)
        value += pa <= pb && pa <= pc ? a : pb <= pc ? b : c
      } else if (filter !== 0) throw new Error(`filtre PNG inconnu : ${filter}`)
      cur[i] = value & 0xff
    }
  }

  const rgba = Buffer.alloc(header.width * header.height * 4)
  for (let p = 0, q = 0; q < rgba.length; p += bpp, q += 4) {
    if (bpp >= 3) {
      rgba[q] = planes[p]
      rgba[q + 1] = planes[p + 1]
      rgba[q + 2] = planes[p + 2]
      rgba[q + 3] = bpp === 4 ? planes[p + 3] : 255
    } else {
      rgba[q] = rgba[q + 1] = rgba[q + 2] = planes[p]
      rgba[q + 3] = bpp === 2 ? planes[p + 1] : 255
    }
  }
  return { width: header.width, height: header.height, rgba }
}

// ------------------------------------------------------------ redimension

/** Recouvrements d'un pixel cible sur l'axe source, bornes comprises. */
function spans(size, dim, zoom) {
  const content = size * zoom
  const offset = (size - content) / 2
  const out = []
  for (let i = 0; i < size; i++) {
    const from = ((i - offset) / content) * dim
    const to = ((i + 1 - offset) / content) * dim
    const weights = []
    for (let s = Math.floor(from); s < Math.ceil(to); s++) {
      const overlap = Math.min(to, s + 1) - Math.max(from, s)
      if (overlap <= 0) continue
      // Hors cadre, on prolonge le pixel de bord. Le degrade de la source
      // etant vertical, la bande ainsi creee par un zoom < 1 se raccorde sans
      // couture — et elle tombe de toute facon dans la marge que le masque
      // d'Android decoupe.
      weights.push([Math.min(dim - 1, Math.max(0, s)), overlap])
    }
    out.push(weights)
  }
  return out
}

/**
 * Reechantillonne en moyennant les surfaces : sur une reduction de 1000 a
 * 48 px, prendre le pixel le plus proche donnerait une icone qui scintille.
 *
 * `zoom` inferieur a 1 reduit le motif dans le cadre — necessaire pour
 * l'icone adaptative d'Android, dont seul le disque central de 66 dp sur 108
 * est garanti visible. `circle` decoupe un disque, pour l'icone ronde des
 * lanceurs d'avant Android 8.
 */
function resample(source, { size, zoom = 1, circle = false }) {
  const { width, height, rgba } = source
  const cols = spans(size, width, zoom)
  const rows = spans(size, height, zoom)
  const out = Buffer.alloc(size * size * 4)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0, total = 0
      for (const [sy, wy] of rows[y]) {
        for (const [sx, wx] of cols[x]) {
          const w = wy * wx
          const i = (sy * width + sx) * 4
          const alpha = (rgba[i + 3] / 255) * w
          r += rgba[i] * alpha
          g += rgba[i + 1] * alpha
          b += rgba[i + 2] * alpha
          a += alpha
          total += w
        }
      }
      const o = (y * size + x) * 4
      out[o] = a ? Math.round(r / a) : 0
      out[o + 1] = a ? Math.round(g / a) : 0
      out[o + 2] = a ? Math.round(b / a) : 0
      out[o + 3] = Math.round((a / total) * 255)
    }
  }

  if (circle) {
    const c = (size - 1) / 2
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = Math.hypot(x - c, y - c)
        // Un demi-pixel de transition, sinon le bord du disque crenelle.
        const edge = Math.min(1, Math.max(0, c - d + 0.5))
        const o = (y * size + x) * 4 + 3
        out[o] = Math.round(out[o] * edge)
      }
    }
  }

  return encodePng(size, size, out)
}

// ------------------------------------------------------------------- sortie

if (!existsSync(SOURCE)) {
  console.error(`${SOURCE} introuvable — lance ce script depuis le dossier web/`)
  process.exit(1)
}
const source = decodePng(readFileSync(SOURCE))
const write = (file, buffer) => {
  writeFileSync(file, buffer)
  console.log(`ecrit ${file}`)
}

mkdirSync('public/icons', { recursive: true })
for (const [file, options] of [
  ['public/icons/icon-192.png', { size: 192 }],
  ['public/icons/icon-512.png', { size: 512 }],
  // Maskable : le motif tient deja dans le disque de securite de 80 % exige
  // par la specification, donc pas de reduction a appliquer.
  ['public/icons/maskable-512.png', { size: 512 }],
  ['public/icons/apple-touch-icon.png', { size: 180 }],
]) {
  write(file, resample(source, options))
}

if (process.argv.includes('--android')) {
  const res = 'android/app/src/main/res'
  if (!existsSync(res)) {
    console.error(`${res} introuvable — lance d'abord \`npx cap add android\``)
    process.exit(1)
  }

  for (const [density, scale] of [
    ['mdpi', 1],
    ['hdpi', 1.5],
    ['xhdpi', 2],
    ['xxhdpi', 3],
    ['xxxhdpi', 4],
  ]) {
    const dir = `${res}/mipmap-${density}`
    mkdirSync(dir, { recursive: true })
    // Icone classique, 48 dp, pour les lanceurs d'avant Android 8.
    write(`${dir}/ic_launcher.png`, resample(source, { size: Math.round(48 * scale) }))
    write(`${dir}/ic_launcher_round.png`, resample(source, { size: Math.round(48 * scale), circle: true }))
    // Calque de l'icone adaptative, 108 dp. Le zoom laisse le motif dans le
    // disque de securite de 66 dp quelle que soit la forme du masque.
    write(
      `${dir}/ic_launcher_adaptive.png`,
      resample(source, { size: Math.round(108 * scale), zoom: 0.92 })
    )
    // Reliquats de l'icone dessinee par le code, remplacee par cette source.
    rmSync(`${dir}/ic_launcher_foreground.png`, { force: true })
  }
  rmSync(`${res}/drawable-v24/ic_launcher_foreground.xml`, { force: true })
  rmSync(`${res}/drawable-v24`, { recursive: true, force: true })
  rmSync(`${res}/drawable/ic_launcher_background.xml`, { force: true })
  rmSync(`${res}/values/ic_launcher_background.xml`, { force: true })
}
