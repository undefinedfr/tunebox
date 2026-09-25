import { Capacitor } from '@capacitor/core'
import { Directory, Filesystem } from '@capacitor/filesystem'

/** Dossier prive de l'app : invisible dans la galerie, efface a la desinstallation. */
const DIRECTORY = Directory.Data

export const MEDIA_DIR = 'media'
export const COVERS_DIR = 'covers'

export async function ensureDirs(): Promise<void> {
  for (const path of [MEDIA_DIR, COVERS_DIR]) {
    try {
      await Filesystem.mkdir({ directory: DIRECTORY, path, recursive: true })
    } catch {
      // Deja present : mkdir leve plutot que d'etre idempotent.
    }
  }
}

export async function exists(path: string): Promise<boolean> {
  try {
    await Filesystem.stat({ directory: DIRECTORY, path })
    return true
  } catch {
    return false
  }
}

export async function download(url: string, path: string): Promise<void> {
  // downloadFile ecrit en streaming cote natif : un morceau de 40 Mo ne passe
  // jamais par le tas JavaScript du WebView.
  await Filesystem.downloadFile({ url, path, directory: DIRECTORY, recursive: true })
}

export async function remove(path: string): Promise<void> {
  try {
    await Filesystem.deleteFile({ directory: DIRECTORY, path })
  } catch {
    // Deja absent, rien a faire.
  }
}

export async function listFiles(dir: string): Promise<string[]> {
  try {
    const result = await Filesystem.readdir({ directory: DIRECTORY, path: dir })
    return result.files.filter((entry) => entry.type === 'file').map((entry) => entry.name)
  } catch {
    return []
  }
}

/**
 * Transforme un chemin du stockage interne en URL que <audio> et <img>
 * acceptent. Le WebView Android ne sait pas lire un `file://` depuis une page
 * servie en https://localhost ; convertFileSrc passe par le pont Capacitor.
 */
export async function toSrc(path: string): Promise<string> {
  const { uri } = await Filesystem.getUri({ directory: DIRECTORY, path })
  return Capacitor.convertFileSrc(uri)
}

/**
 * Prefixe d'URL d'un dossier entier. Resoudre les fichiers un par un coute un
 * aller-retour par le pont natif : sur un catalogue de cent morceaux, ces deux
 * cents appels se voient a l'ouverture. Ici on en fait un seul par dossier.
 */
export async function dirSrc(dir: string): Promise<(name: string) => string> {
  const { uri } = await Filesystem.getUri({ directory: DIRECTORY, path: dir })
  const prefix = Capacitor.convertFileSrc(uri).replace(/\/+$/, '')
  return (name: string) => `${prefix}/${encodeURIComponent(name)}`
}

export async function totalBytes(dir: string): Promise<number> {
  try {
    const result = await Filesystem.readdir({ directory: DIRECTORY, path: dir })
    return result.files.reduce((sum, entry) => sum + (entry.size ?? 0), 0)
  } catch {
    return 0
  }
}

export async function wipe(): Promise<void> {
  for (const path of [MEDIA_DIR, COVERS_DIR]) {
    try {
      await Filesystem.rmdir({ directory: DIRECTORY, path, recursive: true })
    } catch {
      // Rien a supprimer.
    }
  }
  await ensureDirs()
}
