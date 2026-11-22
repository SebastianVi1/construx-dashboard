import { useLocale } from '../../i18n'
import { GuideIcon, requestGuidedTour, requestGuidePreview } from '../guide'
import { devTourMessages } from './devTourMessages'

/**
 * Dev-only account menu items. "Start tour" restarts the guided tour in the
 * current Company at "Create your first site" (this browser forgets the tour's
 * memory there; saved progress stays). "Preview checklist" opens the
 * getting-started checklist as a brand-new member sees it and starts the
 * first step's tour. Render it only behind `devTools` (`config/env.ts`) so
 * production builds drop it.
 */
export function DevTourItem({ onStart }: { onStart: () => void }) {
  const { locale } = useLocale()
  const t = devTourMessages[locale]
  const badge = (
    <span className="account-menu__dev-badge">
      {t.badge}
      <span className="visually-hidden"> {t.badgeLabel}</span>
    </span>
  )

  return (
    <>
      <button
        type="button"
        className="popover__item"
        onClick={() => {
          onStart()
          requestGuidedTour('tour-site')
        }}
      >
        <GuideIcon width="18" height="18" />
        <span className="account-menu__dev-label">{t.startTour}</span>
        {badge}
      </button>
      <button
        type="button"
        className="popover__item"
        onClick={() => {
          onStart()
          requestGuidePreview()
        }}
      >
        <GuideIcon width="18" height="18" />
        <span className="account-menu__dev-label">{t.previewChecklist}</span>
        {badge}
      </button>
    </>
  )
}
