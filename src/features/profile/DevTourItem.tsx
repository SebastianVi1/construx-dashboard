import { useLocale } from '../../i18n'
import { GuideIcon, requestGuidePreview } from '../guide'
import { devTourMessages } from './devTourMessages'

/**
 * Dev-only account menu item: previews the getting-started guide as a
 * brand-new member sees it, then starts the first step's tour. Render it only
 * behind `devTools` (`config/env.ts`) so production builds drop it.
 */
export function DevTourItem({ onStart }: { onStart: () => void }) {
  const { locale } = useLocale()
  const t = devTourMessages[locale]

  return (
    <button
      type="button"
      className="popover__item"
      onClick={() => {
        onStart()
        requestGuidePreview()
      }}
    >
      <GuideIcon width="18" height="18" />
      <span className="account-menu__dev-label">{t.startTour}</span>
      <span className="account-menu__dev-badge">
        {t.badge}
        <span className="visually-hidden"> {t.badgeLabel}</span>
      </span>
    </button>
  )
}
