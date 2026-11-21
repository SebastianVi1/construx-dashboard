import { useEffect, useEffectEvent, useReducer, useRef, useState, type ReactNode } from 'react'
import { useOnboarding } from '../onboarding'
import { usePermissions } from '../permissions'
import { GuideContext } from './guide-context'
import { getGuide, markGuideStepRemote, setGuideDismissed, type GuideStepStatus } from './guideApi'
import { subscribeGuideSteps, type GuideMark } from './guideEvents'
import { createGuideSaves } from './guideSaves'
import { acceptsMark, guideReducer, initialGuideState } from './guideState'
import { GuideLauncher } from './GuideLauncher'
import { GuidePanel } from './GuidePanel'
import { guideProgressOf, selectGuide } from './selection'
import { guideVisibility, onboardingAnswer } from './visibility'

/**
 * The getting-started guide for one Company. Mount it inside the per-Company
 * `PermissionsProvider` (keyed by Company): a switch remounts it, so progress
 * reloads, the panel closes, and nothing is saved to the previous Company.
 * Renders the launcher and the panel next to its children.
 */
export function GuideProvider({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  const { access } = usePermissions()
  const onboarding = useOnboarding()
  const [state, dispatch] = useReducer(guideReducer, initialGuideState)
  const [isOpen, setIsOpen] = useState(false)
  const [autoOpened, setAutoOpened] = useState(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const [saves] = useState(() =>
    createGuideSaves({
      markStep: (stepId, status) => markGuideStepRemote(organizationId, stepId, status),
      setDismissed: (dismissed) => setGuideDismissed(organizationId, dismissed),
    }),
  )
  const autoOpenSaved = useRef(false)

  useEffect(() => {
    let active = true
    getGuide(organizationId).then(
      (progress) => {
        if (active) dispatch({ type: 'loaded', progress })
      },
      // Without progress the guide stays out of the way; the sidebar entry still opens it.
      () => {},
    )
    return () => {
      active = false
    }
  }, [organizationId])

  const sections = selectGuide(access)
  const { progress } = state
  const count = guideProgressOf(sections, progress)
  const dismissed = progress.dismissedAt !== null
  const answer = onboardingAnswer(onboarding.status, onboarding.intent)
  const visibility = guideVisibility({
    hasSteps: count.total > 0,
    loaded: state.loaded,
    started: progress.started,
    dismissed,
    complete: count.complete,
    onboarding: answer,
  })

  // Open by itself once per mount, the first time the rules allow it.
  if (visibility.autoOpen && !autoOpened) {
    setAutoOpened(true)
    setIsOpen(true)
  }

  // ...and record that the member has seen it, so it never opens by itself again.
  // The ref keeps StrictMode's second effect run from sending it twice.
  useEffect(() => {
    if (!autoOpened || autoOpenSaved.current) return
    autoOpenSaved.current = true
    saves.dismiss(false)
  }, [autoOpened, saves])

  function apply(stepId: string, status: GuideStepStatus) {
    if (!acceptsMark(sections, progress, stepId, status)) return
    const action = { type: 'marked', stepId, status, at: new Date().toISOString() } as const
    dispatch(action)
    saves.step(stepId, status)
    const after = guideProgressOf(sections, guideReducer(state, action).progress)
    if (!count.complete && after.complete) setJustCompleted(true)
  }

  const onMark = useEffectEvent((mark: GuideMark) => {
    if (mark.organizationId !== null && mark.organizationId !== organizationId) return
    apply(mark.stepId, 'COMPLETED')
  })

  useEffect(() => subscribeGuideSteps(onMark), [])

  function setDismissed(next: boolean) {
    dispatch({ type: 'dismissed', dismissed: next, at: new Date().toISOString() })
    saves.dismiss(next)
  }

  function close() {
    setIsOpen(false)
    // The panel already showed "You're set up"; the launcher doesn't repeat it.
    setJustCompleted(false)
  }

  const launcherVisible = !isOpen && answer !== 'unanswered' && (visibility.launcher || (justCompleted && !dismissed))

  return (
    <GuideContext.Provider
      value={{
        sections,
        progress,
        count,
        dismissed,
        isOpen,
        launcherVisible,
        justCompleted,
        open: () => {
          setIsOpen(true)
          saves.retryFailed()
        },
        close,
        skip: (stepId) => apply(stepId, 'SKIPPED'),
        hide: () => {
          setDismissed(true)
          close()
        },
        show: () => setDismissed(false),
        acknowledgeCompletion: () => setJustCompleted(false),
      }}
    >
      {children}
      <GuideLauncher />
      {isOpen ? <GuidePanel /> : null}
    </GuideContext.Provider>
  )
}
