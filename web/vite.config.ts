import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const API_TARGET = process.env.API_TARGET || 'http://localhost:8080'

/**
 * Le meme code source produit deux applications :
 *
 *  - le build web (defaut) parle au serveur, met en cache via un service
 *    worker et embarque l'espace parent complet ;
 *  - le build natif (VITE_NATIVE=1, utilise par Capacitor) lit un catalogue
 *    SQLite local et des fichiers deposes sur l'appareil, et remplace l'espace
 *    parent par le seul ecran de synchronisation.
 *
 * Trois alias suffisent a les separer. Passer par des alias plutot que par des
 * `if` garantit qu'aucune dependance Capacitor n'atterrit dans le bundle web,
 * et qu'aucun service worker ne tourne dans le WebView Android.
 */
const NATIVE = process.env.VITE_NATIVE === '1'
const src = (path: string) => fileURLToPath(new URL(`./src/${path}`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@catalog': NATIVE ? src('native/catalog.ts') : src('lib/catalog.ts'),
      '@parent': NATIVE ? src('native/Sync.tsx') : src('Admin.tsx'),
      '@platform': NATIVE ? src('native/platform.ts') : src('lib/platform.ts'),
    },
  },
  plugins: [
    react(),
    tailwindcss(),
    ...(NATIVE
      ? []
      : [
          VitePWA({
            strategies: 'injectManifest',
            srcDir: 'src',
            filename: 'sw.ts',
            registerType: 'autoUpdate',
            injectRegister: 'auto',
            injectManifest: {
              globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
            },
            manifest: {
              name: 'Ma musique',
              short_name: 'Ma musique',
              description: 'Le lecteur de musique de la maison',
              lang: 'fr',
              id: '/',
              start_url: '/',
              scope: '/',
              // display_override tente le plein ecran d'abord sur les navigateurs
              // recents ; display reste sur 'standalone', mieux supporte par les
              // raccourcis Android quand le WebAPK n'a pas pu etre genere.
              display: 'standalone',
              display_override: ['fullscreen', 'standalone', 'minimal-ui'],
              orientation: 'any',
              background_color: '#0b1020',
              theme_color: '#0b1020',
              icons: [
                { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
              ],
              // Permet d'ajouter un titre depuis le menu "Partager" de l'app YouTube.
              share_target: {
                action: '/admin',
                method: 'GET',
                params: { title: 'title', text: 'text', url: 'url' },
              },
            },
            devOptions: { enabled: false },
          }),
        ]),
  ],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      ['/api', '/media', '/covers'].map((p) => [p, { target: API_TARGET, changeOrigin: true }])
    ),
  },
  build: { outDir: 'dist', sourcemap: false },
})
