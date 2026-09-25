# Tunebox

**A self-hosted music player for a small child.** A grid of big sound buttons
on a tablet: no video, no ads, no recommendations, no way out to the rest of
the internet.

Tracks are downloaded once to your own server, then served as plain audio
files. Playback starts instantly, works offline, and depends on no third-party
service.

- **Kid screen** (`/`) — a grid of covers, a player pinned to the bottom. Nothing else.
- **Parent area** (`/admin`) — add tracks, pick covers, reorder buttons.
- **Parent access from the tablet** — press and hold the top-right corner for 2 seconds, then enter a PIN.

*The full documentation is in French: [README.md](README.md). This page is the
short version.*

---

## Before you start

**On legality.** Downloading audio from YouTube is outside YouTube's terms of
service. This tool is meant for private family use on a server you own. That is
your call, not the software's — and it depends on your jurisdiction. The
project circumvents no technical protection measure: it shells out to
[yt-dlp](https://github.com/yt-dlp/yt-dlp) and stops there.

**On security.** The catalogue and the audio files are served **without
authentication**, by design — that is what lets the tablet play a track with no
session. Do not expose Tunebox to the internet without an authentication layer
in front. See [SECURITY.md](SECURITY.md).

---

## Install the server

You need a machine running Docker — a NAS, a VPS, an old laptop, a Raspberry
Pi. Budget 2–4 MB per track.

```bash
git clone https://github.com/undefinedfr/tunebox.git
cd tunebox
cp .env.example .env     # set ADMIN_PIN and SESSION_SECRET
docker compose up -d
```

The first run builds the image locally, so it targets the machine's own CPU,
Intel or ARM. It takes 3 to 8 minutes. To skip the build, set `TUNEBOX_IMAGE`
in `.env` and use `docker-compose.image.yml` instead.

Check it: `http://SERVER-IP:8080/api/health` should answer
`{"ok":true,"ytdlp":"..."}`.

**On a VPS with a domain name**, `deploy/vps/` ships a compose file with
[Caddy](https://caddyserver.com), which obtains and renews a Let's Encrypt
certificate on its own. Its `Caddyfile` also carries a commented `basic_auth`
block — use it, a VPS is reachable from the whole internet.

## Add music

Open `http://SERVER-IP:8080/admin`, enter the PIN. Paste a YouTube video or
playlist URL, search by name, or import a public Spotify playlist (see the
French README for the Spotify credentials). Nothing is downloaded until you
confirm the selection, so you can fix titles first.

Each track then goes through download → loudness normalisation → cover art.
The list order is the button order on the tablet.

## Install on the tablet

| | Android app | Installed PWA | Browser tab |
|---|---|---|---|
| Needs HTTPS | **no** | yes | no |
| Needs the server to play | **never** | on first launch | always |
| Plays with the screen off | no | **yes** | yes |
| Can add tracks | no | yes | yes |

**The Android app is the recommended path.** The APK bundles the kid interface,
a local SQLite catalogue and the audio files. It copies everything from your
server once, then never needs it again — no HTTPS, no VPN, no server running.
Grab `tunebox.apk` from the [releases](../../releases), install it, press and
hold the top-right corner, and enter your server's address.

Android's own screen pinning then replaces any kiosk app. See
[docs/android.md](docs/android.md).

**The PWA** is better on one point only: it keeps playing with the screen off.
It requires HTTPS — through Tailscale, a domain name, or a reverse proxy. The
French README walks through all three.

## Configuration

Every variable is documented in [`.env.example`](.env.example). The two
required ones are `ADMIN_PIN` and `SESSION_SECRET`.

## Development

```bash
brew install ffmpeg yt-dlp deno   # Node 22+ as well
npm run install:all
cp .env.example .env
npm run dev                        # API on :8080, UI on :5173
```

One source tree produces two applications: the web build talks to the server,
the native build reads a local SQLite database. Three aliases in
`web/vite.config.ts` switch between them — see
[docs/android.md](docs/android.md).

## Contributing

Contributions are welcome, especially ones that make installation simpler or
fix a bug. Read [CONTRIBUTING.md](CONTRIBUTING.md) first. The codebase and its
comments are in French; please keep that consistent.

## License

[MIT](LICENSE).
