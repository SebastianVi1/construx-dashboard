import type { GuideTourTarget } from './catalog'
import type { TourTarget } from './tourCatalog'

/**
 * A `data-tour` attribute takes only a tour target of the checklist or the
 * guided tour catalog, so a misspelt one fails the build instead of leaving
 * its tour on "target missing". Type-only: nothing imports this file at run time.
 */
declare module 'react' {
  // An augmentation must repeat React's type parameter, used or not.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLAttributes<T> {
    'data-tour'?: GuideTourTarget | TourTarget
  }
}
