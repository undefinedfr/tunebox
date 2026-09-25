/**
 * Pendant web des capacites natives. Le build Android remplace ce module par
 * `src/native/platform.ts` via l'alias `@platform` (voir vite.config.ts).
 */
export function useKeepAwake(_active: boolean) {
  // Dans un navigateur, le service worker et la Media Session gerent deja la
  // lecture ecran eteint.
}

export const IS_NATIVE = false
