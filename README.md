# Tunebox

**Un lecteur de musique pour enfant, auto-hébergé.** Une grille de gros boutons
sonores sur une tablette : pas de vidéo, pas de publicité, pas de
recommandations, aucune sortie possible vers le reste d'Internet.

Les morceaux sont téléchargés une fois sur ton serveur puis servis comme de
simples fichiers audio. La lecture démarre instantanément, continue hors ligne,
et ne dépend d'aucun service tiers.

- **Écran enfant** (`/`) — une grille de pochettes, un lecteur collé en bas. Rien d'autre.
- **Espace parent** (`/admin`) — ajout de morceaux, pochettes, ordre des boutons.
- **Accès parent depuis la tablette** — appui long de 2 secondes dans le coin en haut à droite, puis code PIN.

*[English README](README.en.md) · [Journal des modifications](CHANGELOG.md) · [Application Android](docs/android.md)*

---

## Avant de commencer

**Sur la légalité.** Télécharger l'audio depuis YouTube sort des conditions
d'utilisation de YouTube. Cet outil est prévu pour un usage familial privé, sur
un serveur qui t'appartient. C'est ta décision, pas celle du logiciel — et elle
dépend de ton pays. Le projet ne contourne aucune protection technique : il
s'appuie sur [yt-dlp](https://github.com/yt-dlp/yt-dlp) et s'arrête là.

**Sur la sécurité.** Le catalogue et les fichiers audio sont servis sans
authentification, par conception — c'est ce qui permet à la tablette de jouer
un morceau sans session. N'expose pas Tunebox sur Internet sans une couche
d'authentification devant. Voir [SECURITY.md](SECURITY.md).

**Ce qu'il te faut :** une machine qui fait tourner Docker (NAS, VPS, vieux
portable, Raspberry Pi), et une tablette ou un téléphone Android. Compte 2 à
4 Mo par morceau : cent chansons tiennent dans 300 Mo.

---

## 1. Installer le serveur

### 1.1 Récupérer le projet et le configurer

```bash
git clone https://github.com/undefinedfr/tunebox.git
cd tunebox
cp .env.example .env
```

Ouvre `.env` et remplis les deux premières lignes :

```ini
ADMIN_PIN=4271
SESSION_SECRET=colle-ici-une-longue-chaine-aleatoire-unique
```

Pour la chaîne aléatoire : `openssl rand -hex 32`. Le PIN fait 4 à 8 chiffres —
prends-en un que ton enfant ne verra pas par-dessus ton épaule.

### 1.2 Démarrer

```bash
docker compose up -d
```

Le premier lancement compile l'image sur place, donc directement pour le
processeur de la machine, Intel ou ARM. Compte 3 à 8 minutes : il construit
l'interface et installe ffmpeg, yt-dlp et Deno.

Pour éviter cette compilation — utile sur un NAS peu puissant — renseigne
`TUNEBOX_IMAGE` dans `.env` et utilise l'autre fichier :

```bash
docker compose -f docker-compose.image.yml pull
docker compose -f docker-compose.image.yml up -d
```

### 1.3 Vérifier

```
http://IP-DU-SERVEUR:8080/api/health
```

Réponse attendue : `{"ok":true,"ytdlp":"2026.xx.xx"}`. Si `ytdlp` vaut `null`,
le conteneur n'avait pas accès à Internet au démarrage — relance-le.

<details>
<summary><b>Sur un Synology, via Container Manager</b></summary>

Dans **File Station**, crée `docker/tunebox` dans le dossier partagé `docker`
(chemin réel `/volume1/docker/tunebox`) et dépose tout le contenu du dépôt
dedans, ainsi que ton fichier `.env`.

Avec le SSH activé, c'est plus direct depuis ton poste :

```bash
rsync -av --exclude node_modules --exclude dist --exclude data \
  ./ ton-nas:/volume1/docker/tunebox/
```

Puis **Container Manager** → **Projet** → **Créer** :

| Champ | Valeur |
|---|---|
| Nom du projet | `tunebox` |
| Chemin | `/volume1/docker/tunebox` |
| Source | **Créer un docker-compose.yml** → il détecte celui présent, garde-le |

**Suivant**, puis **Terminé**. Tu n'as rien à choisir concernant
l'architecture : l'image se construit sur le NAS.

Les journaux sont dans **Container Manager** → **Conteneur** → `tunebox` →
**Journal**.

</details>

<details>
<summary><b>Sur un VPS, avec un nom de domaine et HTTPS automatique</b></summary>

Le dossier `deploy/vps/` contient un compose avec [Caddy](https://caddyserver.com),
qui obtient et renouvelle un certificat Let's Encrypt tout seul.

Prérequis : les ports 80 et 443 libres, et un enregistrement DNS `A` (et
`AAAA` si IPv6) pointant vers le VPS.

```bash
cd deploy/vps
cp .env.example .env     # ADMIN_PIN, SESSION_SECRET, TUNEBOX_DOMAIN, TUNEBOX_EMAIL
docker compose up -d
```

Tunebox n'expose alors aucun port sur l'extérieur : seul Caddy l'atteint.

> **Un VPS est accessible depuis Internet entier.** Le `Caddyfile` fourni
> contient un bloc `basic_auth` prêt à décommenter pour protéger `/admin` par
> un mot de passe, en plus du code PIN. Prends deux minutes pour le faire.

</details>

---

## 2. Ajouter des morceaux

Va sur `http://IP-DU-SERVEUR:8080/admin` et saisis le PIN. Trois portes
d'entrée :

**Lien YouTube** — colle l'URL d'une vidéo ou d'une playlist entière. Tu vois
d'abord la liste des titres avec leurs miniatures ; **rien n'est téléchargé à
cette étape**. Tu décoches ce que tu ne veux pas, tu corriges les titres
(« Bébé Requin » plutôt que « Baby Shark Dance | #babyshark Most Viewed… »),
puis tu valides.

**Rechercher** — tape simplement « comptine petit escargot » si tu n'as pas de
lien sous la main.

**Playlist Spotify** — voir la section 5 pour l'activer. Tu récupères les
titres et les vraies pochettes d'album ; le serveur retrouve l'audio
correspondant.

Chaque morceau passe ensuite par : téléchargement → normalisation du volume →
pochette. La liste affiche la progression en direct ; en cas d'échec, le message
d'erreur s'affiche sur la ligne avec un bouton **Réessayer**.

**Modifier un bouton** : tape sur la ligne. Tu peux changer le titre, remplacer
la pochette (photo de la pellicule du téléphone ou adresse d'image), choisir un
emoji et une couleur de fond pour les boutons sans pochette.

**L'ordre de la liste est l'ordre des boutons** sur la tablette. Les flèches ↑↓
le modifient.

---

## 3. Installer sur la tablette

Trois chemins. Le premier est le plus simple et le plus robuste ; les deux
autres existent pour des cas particuliers.

| | Application Android | PWA installée | Onglet de navigateur |
|---|---|---|---|
| HTTPS nécessaire | **non** | oui | non |
| Serveur joignable pour jouer | **jamais** | au 1ᵉʳ lancement | toujours |
| Lecture écran éteint | non | **oui** | oui |
| Ajout de morceaux depuis la tablette | non | oui | oui |
| Mode kiosque | épinglage Android | application tierce | aucun |

### 3.1 Option A — l'application Android (recommandée)

L'APK embarque l'interface enfant, une base SQLite locale et les fichiers
audio. Elle copie le catalogue une fois depuis ton serveur, puis **n'a plus
jamais besoin de lui** : ni HTTPS, ni Tailscale, ni serveur allumé.

1. Récupère `tunebox.apk` dans les [releases](../../releases) du dépôt, ou
   construis-le toi-même (voir [docs/android.md](docs/android.md)).
2. Installe-le sur la tablette — il faut autoriser les « sources inconnues »
   pour l'application qui ouvre le fichier.
3. Ouvre l'app, appui long de 2 secondes en haut à droite.
4. Saisis l'adresse du serveur (`192.168.1.20:8080` suffit) et lance
   **Copier la musique**.

Pour ajouter des morceaux plus tard : tu les ajoutes sur le serveur depuis un
ordinateur, puis tu relances une synchro sur la tablette. Seuls les nouveaux
fichiers sont téléchargés.

**Mode kiosque** — l'épinglage d'écran d'Android suffit, pas besoin
d'application tierce : **Paramètres** → **Sécurité** → **Épinglage d'écran**,
activer, et activer *Demander le code avant d'annuler l'épinglage*. Puis bouton
Aperçu → icône de l'app → **Épingler**.

La seule limite : un WebView Android met la lecture en pause quand l'écran
s'éteint. L'app garde donc l'écran allumé pendant un morceau. Si l'écoute écran
éteint compte, prends l'option B.

### 3.2 Option B — la PWA installée depuis Chrome

C'est la meilleure option pour la lecture écran éteint et pour ajouter des
morceaux depuis la tablette. En échange, **elle exige du HTTPS** : un service
worker — donc le cache hors ligne, le plein écran et l'icône — n'existe que
dans un « contexte sécurisé ». `http://192.168.1.x:8080` n'en est pas un.

Trois façons d'obtenir du HTTPS, de la plus simple à la plus longue :

<details>
<summary><b>Tailscale — un certificat valide en dix minutes, sans rien exposer</b></summary>

Tailscale crée un réseau privé entre tes appareils et fournit un vrai
certificat reconnu par Chrome. Pas de redirection de port sur la box, pas de
proxy inversé, pas de nom de domaine.

1. Installe Tailscale sur le serveur (sur Synology : **Centre de paquets**),
   ouvre-le et connecte-toi.
2. Sur <https://login.tailscale.com/admin>, onglet **DNS** : active
   **MagicDNS** puis **HTTPS Certificates**. Note le nom de ton réseau, de la
   forme `tail1a2b3.ts.net`.
3. Publie l'app, en SSH sur le serveur :

   ```bash
   tailscale serve --bg 8080
   # sur Synology : sudo /var/packages/Tailscale/target/bin/tailscale serve --bg 8080
   ```

   L'app répond alors sur `https://nom-du-serveur.tail1a2b3.ts.net`.

4. **Empêche l'expiration des clés.** C'est le piège classique, et il se
   déclenche six mois plus tard un dimanche soir : par défaut Tailscale fait
   expirer les clés au bout de 180 jours, le serveur sortirait du réseau et
   l'app deviendrait injoignable. Console d'admin → **Machines** → pour **le
   serveur et la tablette** : menu `···` → **Disable key expiry**.

5. Sur la tablette : installe Tailscale depuis le Play Store, connecte-toi avec
   le même compte, active le VPN.

Mets `COOKIE_SECURE=1` dans ton `.env` et relance le conteneur.

</details>

<details>
<summary><b>Un nom de domaine — si le serveur est un VPS</b></summary>

Utilise `deploy/vps/` (voir section 1). Caddy s'occupe du certificat, la PWA
s'installe normalement.

</details>

<details>
<summary><b>DDNS Synology et Let's Encrypt — sans logiciel tiers</b></summary>

**Panneau de configuration** → **Accès externe** → **DDNS** → **Ajouter**,
fournisseur `Synology`, en cochant **Obtenir un certificat de Let's Encrypt**.
Puis **Portail de connexion** → **Avancé** → **Proxy inversé** pour router
`443` vers `localhost:8080`, et une redirection du port 443 sur ta box.

C'est plus long à mettre en place, et surtout **ça expose ton NAS sur
Internet**. À réserver au cas où les deux options précédentes ne conviennent
pas, et à accompagner d'une authentification devant `/admin`.

</details>

Une fois en HTTPS, ouvre l'adresse dans Chrome sur la tablette et choisis
**Installer l'application**.

> **Attention aux surcouches Android.** L'installation en PWA **ne fonctionne
> pas sur EMUI** (Huawei) : Chrome propose bien « Installer l'application »,
> l'icône apparaît, mais la fenêtre meurt avant d'exécuter la moindre ligne de
> JavaScript — vérifié par instrumentation. Le réglage *Démarrage des
> applications* d'EMUI n'y change rien. Sur ces appareils, prends l'option A.

Laisse l'app ouverte quelques minutes après le premier lancement : elle
télécharge tous les morceaux en tâche de fond. Ensuite elle fonctionne même
serveur éteint.

**Mode kiosque** : [Fully Kiosk Browser](https://www.fully-kiosk.com) remplace
à la fois la PWA et l'épinglage d'écran, avec une sortie protégée par code.
Dans **Settings** → **Web Content Settings**, renseigne l'URL de départ et
active *Enable DOM Storage*, *Enable Database Storage* et *Enable Service
Worker* — c'est ce qui conserve le cache hors ligne.

### 3.3 Option C — un simple onglet

Ouvre l'adresse dans le navigateur de la tablette. Tout marche, sauf le hors
ligne et le plein écran. Suffisant pour essayer avant de s'engager.

### 3.4 Partager un titre depuis YouTube

Installe la PWA sur **ton** téléphone (là, l'installation Chrome fonctionne
normalement). Elle apparaît alors dans le menu **Partager** de l'app YouTube :
Partager → **Tunebox** → l'écran d'ajout s'ouvre avec le lien déjà rempli.

---

## 4. Empêcher Android de tuer les applications

Sur les surcouches agressives (EMUI, MIUI, ColorOS), passe l'application — et
Tailscale si tu l'utilises — en gestion manuelle de la batterie, avec tous les
interrupteurs activés. Sur EMUI : **Paramètres** → **Batterie** → **Démarrage
des applications**.

Sans ça, le système coupe Tailscale en arrière-plan et la tablette ne voit plus
les nouveaux morceaux.

Passe aussi la tablette en **Ne pas déranger**, pour qu'aucune bannière
n'apparaisse par-dessus.

---

## 5. Import de playlists Spotify (optionnel)

Lecture seule, pas besoin d'un compte Premium.

1. Va sur <https://developer.spotify.com/dashboard> → **Create app**
   (n'importe quel nom, Redirect URI `http://localhost` — il ne servira pas)
2. Récupère le **Client ID** et le **Client Secret**
3. Ajoute-les au `.env` du serveur :

   ```ini
   SPOTIFY_CLIENT_ID=xxxxxxxx
   SPOTIFY_CLIENT_SECRET=xxxxxxxx
   ```

4. Relance le conteneur

L'onglet « Playlist Spotify » apparaît alors dans l'espace parent. La playlist
doit être **publique** pour être lisible.

---

## 6. Entretien

**Sauvegarde** : tout tient dans le dossier `data` — base SQLite, fichiers
audio, pochettes. C'est le seul dossier à sauvegarder.

**Mise à jour de yt-dlp** : automatique à chaque démarrage du conteneur. Quand
un import se met à échouer sans raison, c'est presque toujours YouTube qui a
changé quelque chose : relance le conteneur. Pour figer la version, mets
`YTDLP_AUTO_UPDATE=0` dans le `.env`.

**Mise à jour de Tunebox** :

```bash
git pull
docker compose up -d --build
```

**Voir les journaux** : `docker compose logs -f tunebox`.

---

## 7. Configuration

Toutes les variables sont documentées dans [`.env.example`](.env.example).

| Variable | Défaut | Rôle |
|---|---|---|
| `ADMIN_PIN` | — | Code PIN de l'espace parent, 4 à 8 chiffres. Obligatoire. |
| `SESSION_SECRET` | — | Signature des sessions parent. Obligatoire. |
| `PORT` | `8080` | Port d'écoute. |
| `DATA_DIR` | `./data` | Base SQLite, audio, pochettes. |
| `COOKIE_SECURE` | `0` | Mets `1` derrière un proxy HTTPS. |
| `YTDLP_AUTO_UPDATE` | `1` | Mets `0` pour figer la version de yt-dlp. |
| `SPOTIFY_CLIENT_ID` | — | Active l'onglet Spotify. |
| `SPOTIFY_CLIENT_SECRET` | — | Idem. |

---

## 8. Développement

```bash
# Prérequis : Node 22+, ffmpeg, yt-dlp et un moteur JS pour yt-dlp
brew install ffmpeg yt-dlp deno

npm run install:all
cp .env.example .env        # renseigne ADMIN_PIN et SESSION_SECRET
npm run dev                 # API sur :8080, interface sur :5173
```

Vite proxifie `/api`, `/media` et `/covers` vers le serveur : travaille sur
<http://localhost:5173>.

Pour tester le build complet comme en production :

```bash
npm run build && npm start   # tout sur http://localhost:8080
```

Le service worker est désactivé en développement — c'est volontaire, il rend le
rechargement à chaud inutilisable.

**Pourquoi Deno ?** YouTube impose une épreuve JavaScript sur les URL de flux.
yt-dlp la résout avec un moteur JS externe plus un script solveur qu'il
télécharge à la demande — d'où le `--remote-components ejs:github` dans
`server/src/lib/media.js`. Sans l'un ou l'autre, **tous** les imports échouent
sur un trompeur « This video is not available ». L'image Docker embarque les
deux.

### Structure

```
server/src/
  index.js              serveur Fastify, fichiers statiques, repli SPA
  lib/config.js         variables d'environnement, création des dossiers
  lib/db.js             schéma SQLite + version du catalogue
  lib/ytdlp.js          métadonnées et recherche (aucun téléchargement)
  lib/media.js          téléchargement, normalisation du volume, pochettes
  lib/ingest.js         file d'attente série des imports
  lib/spotify.js        lecture de playlists (client credentials)
  lib/auth.js           PIN, cookie de session signé
  routes/catalog.js     /api/catalog — le seul endpoint public
  routes/admin.js       /api/admin/* — derrière le PIN

web/src/
  Kids.tsx              écran enfant
  Admin.tsx             espace parent (build web)
  lib/catalog.ts        catalogue via fetch + Cache API (build web)
  lib/player.ts         lecteur : un seul <audio>, Media Session
  native/               catalogue SQLite, synchronisation, écran parent (build Android)
  sw.ts                 service worker : audio, pochettes, catalogue

web/android/            projet Capacitor — voir docs/android.md
deploy/vps/             compose + Caddy pour un VPS avec nom de domaine
```

Le même code source produit deux applications : le build web parle au serveur,
le build natif lit une base SQLite locale. Trois alias dans `vite.config.ts`
font la bascule — voir [docs/android.md](docs/android.md#comment-le-même-code-produit-deux-applications).

---

## Contribuer

Les contributions sont bienvenues, surtout celles qui simplifient
l'installation ou corrigent un bug. Lis [CONTRIBUTING.md](CONTRIBUTING.md)
avant d'ouvrir une pull request.

## Licence

[MIT](LICENSE).
