# Journal des modifications

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le
projet respecte le [versionnage sémantique](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté

- Application Android (Capacitor) qui recopie le catalogue sur la tablette —
  SQLite local, fichiers audio sur l'appareil — et fonctionne ensuite sans
  serveur ni connexion. Lecture seule : l'ajout de morceaux reste sur le
  serveur.
- Déploiement VPS clé en main avec Caddy et un certificat Let's Encrypt
  automatique (`deploy/vps/`).
- `docker-compose.image.yml` pour installer depuis une image déjà construite,
  sans compiler sur le NAS.
- `COOKIE_SECURE` pour marquer le cookie de session `Secure` derrière un proxy
  TLS.
- En-tête CORS sur `/api/catalog`, ce qui ouvre la porte à d'autres clients.
- Intégration continue : build web et natif, image Docker multi-architecture
  sur GHCR, APK joint à chaque release.
- `npm run icons` dérive toutes les icônes — web, PWA, Android — d'un unique
  fichier source, `web/brand/tunebox-icon.png`.

### Modifié

- Le projet devient **Tunebox** et passe sous licence MIT.
- Tailscale devient une option parmi d'autres plutôt qu'un prérequis : le
  README couvre aussi le HTTPS par nom de domaine et l'usage en HTTP sur le
  réseau local avec l'application Android.
- Le cookie de session s'appelle `tunebox_admin`. Les sessions parent ouvertes
  avant la mise à jour demandent de saisir le PIN à nouveau.

### Migration depuis une installation antérieure au renommage

Les données ne bougent pas : même schéma SQLite, même dossier `data/`, monté au
même endroit. Le service Compose, lui, s'appelle désormais `tunebox` et non
plus `musique`.

Docker Compose traite alors l'ancien conteneur comme un orphelin : il ne
l'arrête pas, et le nouveau échoue sur `port is already allocated`. Un
`docker compose down` ordinaire ne le supprime pas non plus, pour la même
raison. Mets donc le projet à plat avant de le relancer :

```bash
docker compose down --remove-orphans
docker compose up -d --build
```

Sur Synology, arrête le projet dans Container Manager avant de reconstruire.

Si la mise à jour a déjà échoué, le conteneur peut tourner sans port publié —
l'application semble alors démarrée mais injoignable. `docker compose up -d
--force-recreate` le remet d'aplomb.

## [1.0.0]

Première version : écran enfant, espace parent, import YouTube et Spotify,
normalisation du volume, PWA hors ligne.
