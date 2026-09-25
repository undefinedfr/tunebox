import { spawn } from 'node:child_process'

/**
 * Lance un binaire et resout avec stdout. Rejette avec les dernieres lignes de
 * stderr : c'est ce qu'on affiche a l'utilisateur quand un import echoue.
 */
export function run(bin, args, { timeout = 15 * 60 * 1000, onLine } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let settled = false

    const timer = setTimeout(() => {
      settled = true
      child.kill('SIGKILL')
      reject(new Error(`${bin} : delai depasse`))
    }, timeout)

    child.stdout.on('data', (chunk) => {
      stdout += chunk
      if (onLine) for (const line of String(chunk).split('\n')) if (line.trim()) onLine(line)
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk
      // yt-dlp garde 200 Mo de logs si on ne borne pas.
      if (stderr.length > 64_000) stderr = stderr.slice(-32_000)
    })

    child.on('error', (err) => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      reject(
        err.code === 'ENOENT'
          ? new Error(`Binaire introuvable : ${bin}. Verifie qu'il est installe dans le conteneur.`)
          : err
      )
    })

    child.on('close', (code) => {
      clearTimeout(timer)
      if (settled) return
      settled = true
      if (code === 0) resolve(stdout)
      else reject(new Error(lastLines(stderr) || `${bin} a quitte avec le code ${code}`))
    })
  })
}

function lastLines(text, n = 4) {
  return String(text)
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(-n)
    .join(' · ')
}
