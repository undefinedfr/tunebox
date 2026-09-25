# Sécurité

## Ce que Tunebox protège, et ce qu'il ne protège pas

Tunebox est conçu pour un réseau familial. Son modèle de menace est « un enfant
de quatre ans » et « un voisin sur le Wi-Fi », pas « Internet ».

Concrètement :

- **L'espace parent** (`/admin` et `/api/admin/*`) est protégé par un code PIN
  et un cookie de session signé (HMAC-SHA256, 12 h). Le PIN est comparé à temps
  constant. C'est suffisant pour empêcher un enfant d'y entrer, pas pour
  résister à une attaque par force brute depuis Internet.
- **Le catalogue, les fichiers audio et les pochettes** sont servis **sans
  authentification**. Quiconque atteint le serveur peut les lire. C'est
  volontaire : c'est ce qui permet à la tablette de jouer un morceau sans
  session, et à l'application Android de se synchroniser.
- **Il n'y a pas de limitation de débit** sur la saisie du PIN.

Conséquence pratique : **n'expose pas Tunebox sur Internet sans une couche
d'authentification devant.** Sur le réseau local ou via un VPN privé
(Tailscale, WireGuard), la configuration par défaut convient. Sur un VPS
accessible publiquement, ajoute une authentification HTTP au niveau du proxy
inverse — le `Caddyfile` fourni dans `deploy/vps/` contient un bloc prêt à
décommenter.

## Bonnes pratiques

- Choisis un `SESSION_SECRET` réellement aléatoire (`openssl rand -hex 32`) et
  ne le partage pas. Le changer invalide toutes les sessions parent.
- Choisis un PIN à 6 chiffres plutôt que 4 si le serveur est joignable au-delà
  de ton salon.
- Mets `COOKIE_SECURE=1` dès que Tunebox est servi en HTTPS.
- Ne commite jamais ton fichier `.env`. Il est déjà dans `.gitignore`.

## Signaler une faille

Ouvre un **avis de sécurité privé** via l'onglet *Security* → *Report a
vulnerability* du dépôt GitHub, plutôt qu'une issue publique.

Merci d'inclure les étapes pour reproduire et l'impact que tu estimes. Ce
projet est maintenu sur du temps libre : compte quelques jours pour une
première réponse.

## Versions supportées

Seule la dernière version publiée reçoit des correctifs. Il n'y a pas de
branche de maintenance.
