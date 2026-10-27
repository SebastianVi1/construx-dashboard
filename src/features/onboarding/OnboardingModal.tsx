import { useState } from 'react'
import { QuestionModal } from '../../components/modal'
import { useLocale } from '../../i18n'
import { useOnboarding } from './onboarding-context'
import { businessTypeSchema, intentSchema, type BusinessType, type Intent } from './onboardingApi'
import { makeBusinessTypeQuestion, makeIntentQuestion } from './questions'

/**
 * Two steps: the required intent, then the optional business type (with a
 * Skip action). The answer is saved once, after the second step.
 */
export function OnboardingModal() {
  const { submit, close } = useOnboarding()
  const { messages: m } = useLocale()
  const [intent, setIntent] = useState<Intent | null>(null)
  const [saving, setSaving] = useState(false)
  const [failed, setFailed] = useState(false)

  async function save(chosenIntent: Intent, businessType: BusinessType | null) {
    setSaving(true)
    setFailed(false)
    try {
      await submit({ intent: chosenIntent, businessType })
    } catch {
      setFailed(true)
      setSaving(false)
    }
  }

  if (!intent) {
    const question = makeIntentQuestion(m.onboarding)
    return (
      <QuestionModal
        key={question.id}
        question={question}
        submitLabel={m.onboarding.continue}
        onSubmit={(optionId) => setIntent(intentSchema.parse(optionId))}
        onClose={close}
      />
    )
  }

  const question = makeBusinessTypeQuestion(m.onboarding)
  return (
    <QuestionModal
      key={question.id}
      question={question}
      submitLabel={m.onboarding.finish}
      busy={saving}
      busyLabel={m.onboarding.saving}
      error={failed ? m.onboarding.saveError : undefined}
      secondaryAction={{ label: m.onboarding.skip, onClick: () => void save(intent, null) }}
      onSubmit={(optionId) => void save(intent, businessTypeSchema.parse(optionId))}
      onClose={close}
    />
  )
}
