/**
 * yt-dlp parle anglais et technique. L'espace parent affiche ces messages tels
 * quels, donc on traduit les cas courants et on garde le texte brut en dernier
 * recours pour ne pas masquer un probleme inattendu.
 */
const RULES = [
  [/sign in to confirm|not a bot|captcha/i,
    "YouTube demande une verification humaine. Reessaie dans quelques minutes."],
  [/private video/i, 'Cette video est privee.'],
  [/members[- ]only|join this channel/i, 'Cette video est reservee aux membres de la chaine.'],
  [/video unavailable|(is|are) not available|content isn.t available|removed by the uploader/i,
    "Cette video n'est plus disponible."],
  [/age[- ]restricted|confirm your age/i, 'Cette video est limitee par age et ne peut pas etre recuperee.'],
  [/http error 404|unable to download webpage/i, "Aucune video a cette adresse."],
  [/unsupported url/i, "Ce lien n'est pas reconnu. Colle une adresse YouTube."],
  [/geo[- ]restricted|not available in your country/i, "Cette video n'est pas disponible depuis la France."],
  [/network|timed out|delai depasse|getaddrinfo|econnrefused/i,
    "Le NAS n'a pas pu joindre Internet. Verifie sa connexion."],
  [/no space left/i, 'Le disque du NAS est plein.'],
]

export function humanise(message) {
  const raw = String(message || '').trim()
  for (const [pattern, friendly] of RULES) {
    if (pattern.test(raw)) return friendly
  }
  // Rien de reconnu : on rend le texte lisible sans le tronquer trop tot.
  return raw.replace(/^ERROR:\s*/i, '').replace(/\s*\(caused by[^)]*\)/i, '').slice(0, 300)
}
