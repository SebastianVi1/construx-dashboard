import { createContext, useContext } from 'react'
import type { BusinessType, Intent, OnboardingAnswer } from './onboardingApi'
import type { RemoteStatus } from './visibility'

export type OnboardingContextValue = {
  /** Server answer for this session, or the local pending answer while signed out. */
  intent: Intent | null
  businessType: BusinessType | null
  /** Load state of `GET /api/onboarding` for the signed-in user. */
  status: RemoteStatus
  isOpen: boolean
  /** Persist an answer (PUT when signed in, localStorage otherwise). Rejects when PUT fails. */
  submit: (answer: OnboardingAnswer) => Promise<void>
  open: () => void
  close: () => void
}

export const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined)

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext)
  if (!context) throw new Error('useOnboarding must be used within an OnboardingProvider')
  return context
}
