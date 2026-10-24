import { useEffect, useState, type ReactNode } from 'react'
import { OnboardingContext } from './onboarding-context'
import { OnboardingFab } from './OnboardingFab'
import { OnboardingModal } from './OnboardingModal'
import { isOnboardingComplete, onboardingQuestions, type OnboardingAnswers } from './questions'

const STORAGE_KEY = 'construx.onboarding'

/**
 * Owns the onboarding answers (shared by every feature that needs them) and the
 * modal open state. Answers persist to localStorage and are exposed through
 * `useOnboarding`; the floating button and the portal-rendered modal live here
 * too so the whole app gets them for free.
 */
export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? (JSON.parse(saved) as OnboardingAnswers) : {}
    } catch {
      return {}
    }
  })
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(answers))
  }, [answers])

  function setAnswer(questionId: string, optionId: string) {
    setAnswers((current) => ({ ...current, [questionId]: optionId }))
  }

  const complete = isOnboardingComplete(onboardingQuestions, answers)

  return (
    <OnboardingContext.Provider
      value={{
        answers,
        isOpen,
        setAnswer,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
      }}
    >
      {children}
      <OnboardingFab visible={!complete && !isOpen} />
      {isOpen && <OnboardingModal />}
    </OnboardingContext.Provider>
  )
}
