import type { Intent } from '../onboarding'
import type { RemoteStatus } from '../onboarding/visibility'

/** Where the member stands with the onboarding question ("How will you use Construx?"). */
export type OnboardingAnswer = 'answered' | 'unanswered' | 'unknown'

export function onboardingAnswer(status: RemoteStatus, intent: Intent | null): OnboardingAnswer {
  if (status !== 'ready') return 'unknown'
  return intent === null ? 'unanswered' : 'answered'
}

export type GuideVisibilityInput = {
  /** The member sees at least one step. */
  hasSteps: boolean
  /** Progress for this Company has loaded. */
  loaded: boolean
  /** The member has a progress row (they have seen the guide, or existed before it shipped). */
  started: boolean
  dismissed: boolean
  complete: boolean
  onboarding: OnboardingAnswer
}

/**
 * Whether the guide opens by itself and whether the launcher shows. It opens
 * by itself only for a member with no progress row, after the onboarding
 * question is answered, so the two never compete. The launcher also waits
 * for an answer: it stays away while onboarding is unanswered or its answer
 * is unknown (loading, or the load failed), and once the guide is hidden or
 * complete. The sidebar entry opens the guide either way.
 */
export function guideVisibility(input: GuideVisibilityInput): { autoOpen: boolean; launcher: boolean } {
  const ready = input.hasSteps && input.loaded
  return {
    autoOpen: ready && !input.started && input.onboarding === 'answered',
    launcher: ready && !input.dismissed && !input.complete && input.onboarding === 'answered',
  }
}
