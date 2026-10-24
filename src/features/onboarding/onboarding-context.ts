import { createContext, useContext } from 'react'
import type { OnboardingAnswers } from './questions'

export type OnboardingContextValue = {
  answers: OnboardingAnswers
  isOpen: boolean
  setAnswer: (questionId: string, optionId: string) => void
  open: () => void
  close: () => void
}

export const OnboardingContext = createContext<OnboardingContextValue | undefined>(undefined)

export function useOnboarding(): OnboardingContextValue {
  const context = useContext(OnboardingContext)
  if (!context) throw new Error('useOnboarding must be used within an OnboardingProvider')
  return context
}
