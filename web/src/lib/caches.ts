// Noms partages entre l'app (prechargement) et le service worker (lecture).
// S'ils divergent, la tablette telecharge deux fois et perd l'offline.
//
// Le prefixe `ycl-` date du nom d'origine du projet. Il reste tel quel a
// dessein : le renommer viderait le cache de toutes les tablettes deja
// installees, qui retelechargeraient l'integralite du catalogue.
export const AUDIO_CACHE = 'ycl-audio-v1'
export const COVER_CACHE = 'ycl-covers-v1'
export const API_CACHE = 'ycl-api-v1'
