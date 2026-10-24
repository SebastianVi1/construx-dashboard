import { createPortal } from 'react-dom'
import { useLocale } from '../../i18n'
import { useOnboarding } from './onboarding-context'
import './onboarding.css'

/**
 * Floating action button that reopens the onboarding modal. Rendered through a
 * portal into `document.body` so it floats above every screen, with a gentle
 * bobbing animation to draw attention until the profile is complete.
 */
export function OnboardingFab({ visible }: { visible: boolean }) {
  const { open } = useOnboarding()
  const { messages: m } = useLocale()

  if (!visible) return null

  return createPortal(
    <button type="button" className="onboarding-fab" onClick={open} aria-label={m.onboarding.openProfile}>
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
      </svg>
    </button>,
    document.body,
  )
}
