import { useEffect, useEffectEvent, useReducer, useRef, useState, type ReactNode } from 'react'
import { isModalOpen } from '../../components/modal'
import { useOnboarding } from '../onboarding'
import { usePermissions } from '../permissions'
import { GuideContext } from './guide-context'
import { getGuide, markGuideStepRemote, setGuideDismissed, type GuideProgress } from './guideApi'
import { guideCommands } from './guideCommands'
import { subscribeGuidePreview, subscribeGuideSites, subscribeGuideSteps, type GuideMark } from './guideEvents'
import { createGuideSaves } from './guideSaves'
import { completionFollowUp, guideReducer, initialGuideState, shownProgress } from './guideState'
import { guideOpenedThisSession, rememberGuideOpened } from './guideSession'
import { GuideLauncher } from './GuideLauncher'
import { GuidePanel } from './GuidePanel'
import { guideProgressOf, selectGuide } from './selection'
import { useGuidedTour } from './useGuidedTour'
import { useGuideTours } from './useGuideTours'
import { guideVisibility, onboardingAnswer } from './visibility'

/**
 * The getting-started guide for one Company. Mount it inside the per-Company
 * `PermissionsProvider` (keyed by Company): a switch remounts it, so progress
 * reloads, the panel closes, and nothing is saved to the previous Company.
 * Renders the launcher and the panel next to its children.
 *
 * A `requestGuidePreview` (the dev-only "Preview checklist") opens a preview:
 * every step open, nothing saved, and the first step's "Show me". It lasts
 * until the panel is closed; a tour hiding the panel doesn't end it. The dev
 * "Start tour" is the guided tour's own request (`useGuidedTour`).
 *
 * The guided tour (`useGuidedTour`) shares the panel, the saves and the step
 * marks: a mark ticks the checklist first, then the tour's running step.
 *
 * Step by step: when a page completes a checklist step for real, the panel
 * opens by itself on it (`completionFollowUp`), once no other modal is open,
 * unless the guide is hidden or the tour already reopens it for that mark.
 */
export function GuideProvider({ organizationId, children }: { organizationId: string; children: ReactNode }) {
  const { access, can } = usePermissions()
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
  // Until the member opens the guide in this tab's session, the launcher glows now and then.
  const [openedOnce, setOpenedOnce] = useState(guideOpenedThisSession)
  if (isOpen && !openedOnce) setOpenedOnce(true)

  const sections = selectGuide(access)
  const { hydrate: hydrateTour, onMark: onTourMark, ...tour } = useGuidedTour({
    organizationId,
    sections,
    canCreateSites: can('MANAGE_PROJECT'),
    saves,
    setOpen: setIsOpen,
  })
  // Reads the checklist as it is when the answer arrives, not when the request started.
  const onLoaded = useEffectEvent((progress: GuideProgress) => {
    dispatch({ type: 'loaded', progress, sections })
    hydrateTour(progress)
  })

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
  const { justCompleted } = state
  const previewing = state.preview !== null
  // Whether the guide opens by itself or shows its launcher follows the real progress, never a preview.
  const real = state.progress
  const realCount = guideProgressOf(sections, real)
  const realDismissed = real.dismissedAt !== null
  const answer = onboardingAnswer(onboarding.status, onboarding.intent)
  const visibility = guideVisibility({
    hasSteps: realCount.total > 0,
    loaded: state.loaded,
    started: real.started,
    dismissed: realDismissed,
    complete: realCount.complete,
    onboarding: answer,
  })
  const progress = shownProgress(state)
  const count = guideProgressOf(sections, progress)
  const dismissed = progress.dismissedAt !== null
  const commands = guideCommands({ state, sections, saves, dispatch })

  // Open by itself once per mount, the first time the rules allow it.
  if (visibility.autoOpen && !autoOpened) {
    setAutoOpened(true)
    setIsOpen(true)
  }

  // ...and record that the member has seen it, so it never opens by itself again.
  // The ref keeps StrictMode's second effect run from sending it twice.
  // A preview writes nothing, so the record waits until it ends.
  useEffect(() => {
    if (!autoOpened || autoOpenSaved.current || previewing) return
    autoOpenSaved.current = true
    saves.dismiss(false)
  }, [autoOpened, previewing, saves])

  // However the panel opens (launcher, sidebar, header, "Show me", a page's "?", or
  // by itself), saves that failed are sent again; not during a preview. A second run finds none left.
  useEffect(() => {
    if (isOpen && !previewing) saves.retryFailed()
  }, [isOpen, previewing, saves])

  useEffect(() => {
    if (openedOnce) rememberGuideOpened()
  }, [openedOnce])

  const onMark = useEffectEvent((mark: GuideMark) => {
    if (mark.organizationId !== organizationId) return
    commands.complete(mark.stepId)
    // The tour reopens the panel on its own timeline for this mark: one path, so the checklist doesn't too.
    if (onTourMark(mark)) dispatch({ type: 'stepDoneShown' })
  })

  useEffect(() => subscribeGuideSteps(onMark), [])

  const onPreview = useEffectEvent(() => {
    dispatch({ type: 'previewStarted' })
    clearNotice()
    setIsOpen(true)
    const first = sections[0]?.steps[0]
    if (first) tours.showMe(first.id)
  })

  useEffect(() => subscribeGuidePreview(onPreview), [])

  useEffect(
    () =>
      subscribeGuideSites((report) => {
        if (report.organizationId === organizationId) setHasSites(report.hasSites)
      }),
    [organizationId],
  )

  // A step a page just completed: open the panel on it, or forget it while the guide is hidden or previewing.
  const followUp = completionFollowUp(state, sections)
  if (followUp === 'drop') dispatch({ type: 'stepDoneShown' })
  const waitingToOpen = followUp === 'open' && !isOpen
  useEffect(() => {
    if (!waitingToOpen) return
    // Never on top of another modal (a dialog still closing, another form): check again until none is open.
    const timer = setInterval(() => {
      if (isModalOpen()) return
      clearInterval(timer)
      setIsOpen(true)
    }, 150)
    return () => clearInterval(timer)
  }, [waitingToOpen])

  function close() {
    setIsOpen(false)
    clearNotice()
    // The panel already showed "You're set up"; the launcher doesn't repeat it.
    dispatch({ type: 'acknowledged' })
    dispatch({ type: 'previewEnded' })
    // The timeline already showed "Tour complete".
    tour.acknowledgeFinish()
  }

  // While the guided tour runs, the launcher stays so "Leave tour" is one click away.
  const launcherVisible =
    !isOpen &&
    (tour.state.active || (answer === 'answered' && (visibility.launcher || (justCompleted && !realDismissed))))

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
        preview: previewing,
        open: () => setIsOpen(true),
        close,
        skip: commands.skip,
        hide: () => {
          commands.setDismissed(true)
          close()
        },
        show: () => commands.setDismissed(false),
        acknowledgeCompletion: () => dispatch({ type: 'acknowledged' }),
        lastDone: state.lastDone,
        doneShown: () => dispatch({ type: 'stepDoneShown' }),
        attention: !openedOnce,
        tour,
        ...tours,
      }}
    >
      {children}
      <GuideLauncher />
      {isOpen ? <GuidePanel /> : null}
    </GuideContext.Provider>
  )
}
