# Application Android

L'application Android est la même interface enfant, mais elle **ne parle à
aucun serveur au moment de la lecture**. Tout ce qu'elle joue est sur la
tablette : le catalogue dans une base SQLite locale, les fichiers audio et les
pochettes dans le stockage privé de l'app.

Le serveur ne sert qu'une fois, au moment de la copie.

## Pourquoi cette version existe

L'installation en PWA a trois contraintes que l'APK fait disparaître :

| | PWA | Application Android |
|---|---|---|
| HTTPS obligatoire | oui (service worker) | non |
| Serveur joignable au démarrage | au premier lancement, et à chaque vidage du cache | jamais après la copie |
| Installation sur les surcouches Android récalcitrantes | aléatoire (voir README, EMUI) | installation normale |
| Ajout de morceaux | oui, via `/admin` | non, lecture seule |

En échange, l'app **n'ajoute pas de musique**. L'import passe toujours par
l'espace parent du serveur, depuis un ordinateur ou un téléphone.

## Ce qui se passe à la synchronisation

1. Appui long de 2 secondes en haut à droite de l'écran enfant → espace parent.
2. Saisis l'adresse du serveur, telle que tu l'utilises dans un navigateur —
   `192.168.1.20:8080` suffit, le `http://` est optionnel.
3. « Copier la musique ». L'app lit `/api/catalog`, télécharge chaque fichier
   manquant, écrit le catalogue en SQLite et supprime les fichiers des morceaux
   retirés depuis.

Une deuxième synchronisation ne retélécharge que ce qui a changé. Tu peux la
lancer depuis n'importe quel réseau où le serveur est joignable, puis rentrer à
la maison et couper le NAS : rien ne casse.

Les téléchargements passent par la couche native de Capacitor, pas par
`fetch` : un morceau de 40 Mo ne transite jamais par la mémoire du WebView, et
il n'y a pas de CORS à configurer côté serveur.

## Limite connue : écran éteint

Un WebView Android met la lecture en pause dès que l'écran s'éteint — il n'y a
pas de service en avant-plan derrière une page web. L'app garde donc l'écran
allumé **tant qu'un morceau joue**, et le laisse s'éteindre à la pause.

Si l'écoute écran éteint compte (endormissement, trajet en voiture), la PWA
installée depuis Chrome reste meilleure sur ce point précis : le navigateur
gère la session média en arrière-plan. Les deux peuvent cohabiter sur la même
tablette.

## Mode kiosque sans application tierce

L'APK rend **Fully Kiosk inutile** : l'épinglage d'écran d'Android suffit.

1. **Paramètres** → **Sécurité** → **Épinglage d'écran** : activer, et activer
   *Demander le code avant d'annuler l'épinglage*.
2. Ouvrir Ma musique, appuyer sur le bouton Aperçu (carré), puis sur l'icône de
   l'app → **Épingler**.
3. Pour sortir : maintenir Retour + Aperçu, puis saisir le code de
   verrouillage.

L'application s'affiche déjà en plein écran, sans barre de statut.

## Construire l'APK soi-même

### Par GitHub Actions (le plus simple)

Le workflow `.github/workflows/android.yml` construit l'APK :

- automatiquement à chaque tag `v*`, et l'attache à la release ;
- à la demande, depuis l'onglet **Actions** → **APK Android** → **Run
  workflow**. L'APK est alors téléchargeable dans les artefacts du run.

Sans keystore configuré, il produit un APK **de debug** — installable, mais
signé par une clé de test. C'est suffisant pour un usage familial.

### En local

Prérequis :

- Node 22+
- JDK 21 (Gradle et le plugin Android refusent les JDK plus récents)
- Le SDK Android avec la plateforme 36 — Android Studio l'installe, ou
  `sdkmanager "platforms;android-36" "build-tools;36.0.0"`

```bash
cd web
npm ci
npm run android:apk:debug      # APK de debug
# ou, avec un keystore configuré :
npm run android:apk            # APK de release signé
```

L'APK sort dans `web/android/app/build/outputs/apk/`.

Pour ouvrir le projet dans Android Studio :

```bash
npm run android:sync && npm run android:open
```

> `npm run android:sync` reconstruit le bundle natif (`VITE_NATIVE=1`) puis le
> recopie dans le projet Android. Un `npm run build` ordinaire produit le
> bundle **web** — avec service worker et espace parent complet — et n'a rien à
> faire dans l'APK.

## Signer une release

Génère un keystore une fois pour toutes, et garde-le précieusement : sans lui,
tu ne pourras plus publier de mise à jour de la même application.

```bash
keytool -genkeypair -v \
  -keystore tunebox.keystore \
  -alias tunebox -keyalg RSA -keysize 2048 -validity 10000
```

**En local** — crée `web/android/keystore.properties` (déjà exclu du dépôt) :

```ini
storeFile=../../tunebox.keystore
storePassword=…
keyAlias=tunebox
keyPassword=…
```

**Dans GitHub Actions** — ajoute quatre secrets au dépôt :

| Secret | Valeur |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | `base64 -i tunebox.keystore` |
| `ANDROID_KEYSTORE_PASSWORD` | le mot de passe du keystore |
| `ANDROID_KEY_ALIAS` | `tunebox` |
| `ANDROID_KEY_PASSWORD` | le mot de passe de la clé |

Le workflow bascule tout seul sur `assembleRelease` dès que
`ANDROID_KEYSTORE_BASE64` existe.

## Comment le même code produit deux applications

Trois alias, définis dans `web/vite.config.ts` selon `VITE_NATIVE` :

| Alias | Build web | Build Android |
|---|---|---|
| `@catalog` | `lib/catalog.ts` — `fetch('/api/catalog')` + Cache API | `native/catalog.ts` — lecture SQLite |
| `@parent` | `Admin.tsx` — import YouTube et Spotify | `native/Sync.tsx` — écran de synchronisation |
| `@platform` | `lib/platform.ts` — sans effet | `native/platform.ts` — maintien de l'écran allumé |

Passer par des alias plutôt que par des `if` garantit qu'aucune dépendance
Capacitor n'atterrit dans le bundle web, et qu'aucun service worker ne tourne
dans le WebView Android.

Tout le reste — l'écran enfant, le lecteur, les tuiles, la barre de lecture —
est strictement le même code.
