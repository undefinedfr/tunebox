import { useEffect } from 'react'
import { KeepAwake } from '@capacitor-community/keep-awake'

/**
 * Un WebView Android met la lecture en pause des que l'ecran s'eteint : il n'y
 * a pas de service en avant-plan derriere une page web. Tant qu'un morceau
 * tourne, on garde donc l'ecran allume — c'est ce que fait deja une tablette
 * posee sur la table pendant l'ecoute, et ca evite une coupure au milieu d'une
 * chanson. L'ecran se rendort des la mise en pause.
 */
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    KeepAwake[active ? 'keepAwake' : 'allowSleep']().catch(() => {})
    return () => {
      if (active) KeepAwake.allowSleep().catch(() => {})
    }
  }, [active])
}

export const IS_NATIVE = true
