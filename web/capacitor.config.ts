import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  // Change l'identifiant si tu publies ta propre version sur un store.
  appId: 'fr.tunebox.app',
  appName: 'Ma musique',
  // Le bundle natif est construit a part (VITE_NATIVE=1) pour qu'aucun build
  // web ne parte par erreur dans l'APK, et inversement.
  webDir: 'dist-native',
  android: {
    // Le serveur familial tourne en clair sur le LAN (http://192.168.x.x:8080).
    // Sans ca, la synchronisation echoue sur un "cleartext not permitted".
    allowMixedContent: true,
  },
  plugins: {
    CapacitorHttp: {
      // Route fetch() par la couche native : pas de preflight CORS a gerer
      // cote serveur, et la synchro marche meme si l'origine du WebView
      // (https://localhost) n'a rien a voir avec celle du NAS.
      enabled: true,
    },
    CapacitorSQLite: {
      androidIsEncryption: false,
    },
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: '#0b1020',
    },
  },
}

export default config
