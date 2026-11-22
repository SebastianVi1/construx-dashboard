import { useEffect, useEffectEvent, useReducer, useRef, useState, type ReactNode } from 'react'
import { useOnboarding } from '../onboarding'
import { usePermissions } from '../permissions'
import type { GuideStepId } from './catalog'
import { GuideContext } from './guide-context'
import { getGuide, markGuideStepRemote, setGuideDismissed, type GuideProgress, type GuideStepStatus } from './guideApi'
import { subscribeGuideSites, subscribeGuideSteps, type GuideMark } from './guideEvents'
import { createGuideSaves } from './guideSaves'
import { acceptsMark, guideReducer, initialGuideState } from './guideState'
import { GuideLauncher } from './GuideLauncher'
import { GuidePanel } from './GuidePanel'
import { guideProgressOf, selectGuide } from './selection'
import { useGuideTours } from './useGuideTours'
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
  // Whether the member sees any open Site here; null until a page has loaded their Sites.
  const [hasSites, setHasSites] = useState<boolean | null>(null)
  const [saves] = useState(() =>
    createGuideSaves({
      markStep: (stepId, status) => markGuideStepRemote(organizationId, stepId, status),
      setDismissed: (dismissed) => setGuideDismissed(organizationId, dismissed),
    }),
  )
  const autoOpenSaved = useRef(false)

  const sections = selectGuide(access)
  // Reads the checklist as it is when the answer arrives, not when the request started.
  const onLoaded = useEffectEvent((progress: GuideProgress) => dispatch({ type: 'loaded', progress, sections }))

  useEffect(() => {
    let active = true
    getGuide(organizationId).then(
      (progress) => {
        if (active) onLoaded(progress)
      },
      // Without progress the guide stays out of the way; the sidebar entry still opens it.
      () => {},
    )
    return () => {
      active = false
    }
  }, [organizationId])

  const { clearNotice, ...tours } = useGuideTours({ organizationId, sections, setOpen: setIsOpen })
  const { progress, justCompleted } = state
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

  // However the panel opens (launcher, sidebar, header, "Show me", a page's "?", or
  // by itself), saves that failed are sent again. A second run finds none left.
  useEffect(() => {
    if (isOpen) saves.retryFailed()
  }, [isOpen, saves])

  function apply(stepId: GuideStepId, status: GuideStepStatus) {
    if (!acceptsMark(sections, progress, stepId, status)) return
    dispatch({ type: 'marked', stepId, status, at: new Date().toISOString(), sections })
    saves.step(stepId, status)
  }

  const onMark = useEffectEvent((mark: GuideMark) => {
    if (mark.organizationId !== organizationId) return
    apply(mark.stepId, 'COMPLETED')
  })

  useEffect(() => subscribeGuideSteps(onMark), [])

  useEffect(
    () =>
      subscribeGuideSites((report) => {
        if (report.organizationId === organizationId) setHasSites(report.hasSites)
      }),
    [organizationId],
  )

  function setDismissed(next: boolean) {
    dispatch({ type: 'dismissed', dismissed: next, at: new Date().toISOString() })
    saves.dismiss(next)
  }

  function close() {
    setIsOpen(false)
    clearNotice()
    // The panel already showed "You're set up"; the launcher doesn't repeat it.
    dispatch({ type: 'acknowledged' })
  }

  const launcherVisible = !isOpen && answer === 'answered' && (visibility.launcher || (justCompleted && !dismissed))

  return (
    <GuideContext.Provider
      value={{
        sections,
        progress,
        count,
        hasSites,
        dismissed,
        isOpen,
        launcherVisible,
        justCompleted,
        open: () => setIsOpen(true),
        close,
        skip: (stepId) => apply(stepId, 'SKIPPED'),
        hide: () => {
          setDismissed(true)
          close()
        },
        show: () => setDismissed(false),
        acknowledgeCompletion: () => dispatch({ type: 'acknowledged' }),
        ...tours,
      }}
    >
      {children}
      <GuideLauncher />
      {isOpen ? <GuidePanel /> : null}
    </GuideContext.Provider>
  )
}
