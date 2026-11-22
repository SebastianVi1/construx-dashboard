import { defineMessages } from '../../i18n/defineMessages'

/**
 * Copy for the dev-only "Start tour" item. Kept out of `messages.ts` on
 * purpose: only `DevTourItem` imports it, so a production build, which drops
 * that item, ships none of this text. The `@__PURE__` mark lets the bundler
 * drop the unused call; without it the text stays in the bundle.
 */
export const devTourMessages = /* @__PURE__ */ defineMessages({
  en: {
    startTour: 'Start tour',
    badge: 'Dev',
    badgeLabel: '(development only)',
  },
  es: {
    startTour: 'Iniciar recorrido',
    badge: 'Dev',
    badgeLabel: '(solo en desarrollo)',
  },
})
