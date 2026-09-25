# Contribuer à Tunebox

Merci de passer par ici. Ce projet est petit et le restera : il fait une chose,
servir de la musique à un enfant sans rien autour. Les contributions les plus
utiles sont celles qui le rendent plus simple à installer ou plus fiable, pas
celles qui ajoutent des fonctionnalités.

## Monter l'environnement

```bash
# Prérequis : Node 22+, ffmpeg, yt-dlp et un moteur JS pour yt-dlp
brew install ffmpeg yt-dlp deno     # macOS
# Debian/Ubuntu : apt install ffmpeg && pipx install yt-dlp && snap install deno

npm run install:all
cp .env.example .env                # renseigne ADMIN_PIN et SESSION_SECRET
npm run dev                         # API sur :8080, interface sur :5173
```

Travaille sur <http://localhost:5173> : Vite proxifie `/api`, `/media` et
`/covers` vers le serveur.

Avant d'ouvrir une pull request :

```bash
npm run typecheck
npm run build
```

## Ce qui est dans le périmètre

- Rendre l'installation plus simple sur une plateforme de plus (Unraid, CasaOS,
  TrueNAS, Proxmox…).
- Corriger un bug de lecture, d'import ou de cache hors ligne.
- Améliorer l'accessibilité et l'ergonomie de l'écran enfant.
- Traduire l'interface — elle est en français en dur pour l'instant, une vraie
  internationalisation est bienvenue.

## Ce qui ne l'est pas

- Les comptes utilisateurs, le multi-locataire, le partage public.
- Tout ce qui ajoute de la publicité, du suivi, ou un appel à un service tiers
  que le parent n'a pas explicitement configuré.
- Contourner les protections techniques d'une plateforme. Tunebox s'appuie sur
  yt-dlp et s'arrête là.

## Style

Le code n'a pas de formateur automatique, juste une convention : deux espaces,
pas de point-virgule côté web, des commentaires qui expliquent **pourquoi**
plutôt que **quoi**. Les commentaires du dépôt sont en français, garde cette
langue pour rester homogène.

Regarde `web/src/lib/player.ts` ou `server/src/lib/media.js` pour le ton :
un commentaire n'est là que quand le code seul induirait en erreur.

## Signaler un bug

Utilise le gabarit d'issue. Le plus utile est presque toujours le journal du
conteneur (`docker compose logs --tail 100 tunebox`) — pense à en retirer ton
PIN et ton `SESSION_SECRET`.

## Licence

En contribuant, tu acceptes que ton travail soit publié sous la licence MIT du
projet.
