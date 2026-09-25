import fs from 'node:fs/promises'
import path from 'node:path'
import { COVERS_DIR, FFMPEG_BIN, FFPROBE_BIN, MEDIA_DIR, TMP_DIR, YTDLP_BIN } from './config.js'
import { humanise } from './errors.js'
import { run } from './proc.js'

/**
 * Cible EBU R128. Sans ca, on passe d'une berceuse a un generique satures et
 * c'est l'incident sonore dans les oreilles de l'enfant.
 */
const LOUDNORM = 'loudnorm=I=-16:TP=-1.5:LRA=11'

async function runFriendly(...args) {
  try {
    return await run(...args)
  } catch (err) {
    throw new Error(humanise(err.message))
  }
}

export async function downloadAudio(sourceUrl, id, onProgress) {
  const workDir = path.join(TMP_DIR, id)
  await fs.mkdir(workDir, { recursive: true })

  try {
    await runFriendly(
      YTDLP_BIN,
      [
        '-f', 'bestaudio/best',
        '--no-playlist',
        '--no-warnings',
        '--ignore-config',
        '--newline',
        // YouTube impose une epreuve JavaScript sur les URL de flux. yt-dlp la
        // resout avec Deno, mais le script solveur se telecharge a la demande
        // et reste desactive par defaut. Sans ce drapeau, toutes les videos
        // remontent en "This video is not available".
        '--remote-components', 'ejs:github',
        '--output', path.join(workDir, 'source.%(ext)s'),
        sourceUrl,
      ],
      {
        timeout: 15 * 60 * 1000,
        onLine: (line) => {
          const match = line.match(/\[download\]\s+([\d.]+)%/)
          if (match && onProgress) onProgress(Number(match[1]))
        },
      }
    )

    const downloaded = (await fs.readdir(workDir)).find((f) => f.startsWith('source.'))
    if (!downloaded) throw new Error('yt-dlp n a produit aucun fichier.')

    const outName = `${id}.m4a`
    const outPath = path.join(MEDIA_DIR, outName)

    await run(FFMPEG_BIN, [
      '-y', '-hide_banner', '-loglevel', 'error',
      '-i', path.join(workDir, downloaded),
      '-vn',
      '-map_metadata', '-1',
      '-af', LOUDNORM,
      '-c:a', 'aac', '-b:a', '160k', '-ar', '44100',
      '-movflags', '+faststart',
      outPath,
    ])

    return { audioFile: outName, duration: await probeDuration(outPath) }
  } finally {
    await fs.rm(workDir, { recursive: true, force: true })
  }
}

async function probeDuration(file) {
  try {
    const out = await run(FFPROBE_BIN, [
      '-v', 'error',
      '-show_entries', 'format=duration',
      '-of', 'default=noprint_wrappers=1:nokey=1',
      file,
    ], { timeout: 30_000 })
    const seconds = Math.round(Number(out.trim()))
    return Number.isFinite(seconds) && seconds > 0 ? seconds : null
  } catch {
    return null
  }
}

/** Les miniatures 16:9 sans bandes noires d'abord, hqdefault en dernier recours. */
export function thumbCandidates(url) {
  const ytId = String(url || '').match(/i\.ytimg\.com\/vi\/([^/]+)\//)?.[1]
  if (!ytId) return [url]
  return [
    `https://i.ytimg.com/vi/${ytId}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${ytId}/hq720.jpg`,
    `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg`,
  ]
}

async function fetchFirstOk(urls) {
  let lastError = 'aucune URL fournie'
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
      if (!res.ok) { lastError = `HTTP ${res.status}`; continue }
      const buffer = Buffer.from(await res.arrayBuffer())
      if (buffer.length > 32) return buffer
      lastError = 'image vide'
    } catch (err) {
      lastError = err.message
    }
  }
  throw new Error(`Pochette inaccessible (${lastError})`)
}

/**
 * Les conteneurs HEIF (photos macOS/iPhone, AVIF) commencent par une boite
 * "ftyp" suivie d'une marque. ffmpeg ne sait pas les demultiplexer : on passe
 * par heif-convert avant.
 */
const HEIF_BRANDS = new Set([
  'heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis', 'hevm', 'hevs', 'avif', 'avis',
])

function isHeif(buffer) {
  return (
    buffer.length >= 12 &&
    buffer.toString('ascii', 4, 8) === 'ftyp' &&
    HEIF_BRANDS.has(buffer.toString('ascii', 8, 12))
  )
}

/**
 * Normalise n'importe quelle source d'image en JPEG carre 512px.
 * On reste en JPEG plutot qu'en WebP : tous les builds ffmpeg savent l'encoder,
 * et a cette taille l'ecart de poids est negligeable.
 *
 * Le nom de fichier change a chaque remplacement. Reutiliser le meme nom
 * obligerait a lutter contre le cache du navigateur, du service worker et du
 * proxy ; une URL neuve rend le probleme inexistant.
 */
export async function makeCover(id, { url, buffer } = {}) {
  const input = buffer ?? (await fetchFirstOk(thumbCandidates(url)))
  const tmpPath = path.join(TMP_DIR, `cover-${id}`)
  await fs.writeFile(tmpPath, input)

  let sourcePath = tmpPath
  const converted = `${tmpPath}.jpg`

  try {
    if (isHeif(input)) {
      try {
        await run('heif-convert', ['-q', '90', tmpPath, converted], { timeout: 60_000 })
        sourcePath = converted
      } catch {
        throw new Error(
          "Ce format d'image (HEIC) n'a pas pu etre converti. Exporte la photo en JPEG et reessaie."
        )
      }
    }

    const outName = `${id}-${Date.now().toString(36)}.jpg`
    try {
      await run(FFMPEG_BIN, [
        '-y', '-hide_banner', '-loglevel', 'error',
        '-i', sourcePath,
        '-vf', 'scale=512:512:force_original_aspect_ratio=increase,crop=512:512',
        '-q:v', '4',
        path.join(COVERS_DIR, outName),
      ])
    } catch (err) {
      throw new Error(`Image illisible : ${String(err.message).slice(0, 160)}`)
    }
    return outName
  } finally {
    await fs.rm(tmpPath, { force: true })
    await fs.rm(converted, { force: true })
  }
}

export async function removeFiles({ audioFile, coverFile }) {
  if (audioFile) await fs.rm(path.join(MEDIA_DIR, audioFile), { force: true })
  if (coverFile) await fs.rm(path.join(COVERS_DIR, coverFile), { force: true })
}
