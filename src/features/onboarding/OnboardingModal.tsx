import { QuestionModal } from '../../components/modal'
import { useLocale } from '../../i18n'
import { useOnboarding } from './onboarding-context'
import { isOnboardingComplete, onboardingQuestions } from './questions'

/**
 * Shows the first unanswered onboarding question and advances through the rest
 * in order. Closes itself once every question has an answer; the modal itself
 * renders through the portal inside `Modal`.
 */
export function OnboardingModal() {
  const { answers, setAnswer, close } = useOnboarding()
  const { messages: m } = useLocale()
  const current = onboardingQuestions.find((question) => !answers[question.id])

  if (!current) return null

  const question = current

  function handleSubmit(optionId: string) {
    const next = { ...answers, [question.id]: optionId }
    setAnswer(question.id, optionId)
    if (isOnboardingComplete(onboardingQuestions, next)) close()
  }

  return (
    <QuestionModal
      question={question}
      submitLabel={m.onboarding.continue}
      onSubmit={handleSubmit}
      onClose={close}
    />
  )
}
