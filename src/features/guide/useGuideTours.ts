import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useLocale } from '../../i18n'
import type { GuidePageId, GuideStepEntry, GuideStepId } from './catalog'
import { subscribeGuideSiteOpened } from './guideEvents'
import { guidePath, showMeOutcome, siteIdInPath, stepsOnPage, type GuideNoticeKind } from './guidePaths'
import { readLastSite, rememberLastSite } from './lastSite'
import type { GuideSection } from './selection'
import { destroyActiveTour, isPhoneWidth, startTour, tourStops } from './tour'

/** A hint the panel shows under one step after "Show me" (see `GuideNoticeKind`). */
export type GuideNotice = { stepId: GuideStepId; kind: GuideNoticeKind }

export type GuideTours = {
  /** The last Site visited in this Company (since the guide mounted, or remembered from before). */
  lastSiteId: string | null
  notice: GuideNotice | null
  clearNotice: () => void
  /** Open the step's page and spotlight its targets; on phones keep the sheet open with the step's text as the hint. */
  showMe: (stepId: GuideStepId) => void
  /** Replay the tours of the member's steps on a page (the page's "?"). On phones, open the sheet on the first one's hint. */
  replayPage: (pageId: GuidePageId) => void
}

/**
 * "Show me" and page replays for the guide of one Company. Lives inside
 * `GuideProvider`, so a Company switch unmounts it and closes any tour.
 */
export function useGuideTours({
  organizationId,
  sections,
  setOpen,
}: {
  organizationId: string
  sections: GuideSection[]
  setOpen: (open: boolean) => void
}): GuideTours {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { messages: m } = useLocale()
  const [notice, setNotice] = useState<GuideNotice | null>(null)
  const [lastSiteId, setLastSiteId] = useState(() => readLastSite(organizationId))

  // The URL survives a Company switch, so the page the guide mounted on may be a
  // Site of the previous Company: only Sites opened after mounting are remembered.
  const [mountPath] = useState(pathname)
  const [moved, setMoved] = useState(false)
  const movedNow = moved || pathname !== mountPath
  if (movedNow && !moved) setMoved(true)
  const siteHere = movedNow ? siteIdInPath(pathname) : null
  if (siteHere !== null && siteHere !== lastSiteId) setLastSiteId(siteHere)

  // A Site page that loaded its Site in this Company proves the Site is ours, even
  // when the guide mounted on that page (a reload or a link straight to the Site).
  useEffect(
    () =>
      subscribeGuideSiteOpened((opened) => {
        if (opened.organizationId === organizationId) setLastSiteId(opened.siteId)
      }),
    [organizationId],
  )

  useEffect(() => {
    if (lastSiteId !== null) rememberLastSite(organizationId, lastSiteId)
  }, [organizationId, lastSiteId])

  // One tour at a time, and none outlives this Company's guide.
  useEffect(() => destroyActiveTour, [])

  async function spotlight(steps: GuideStepEntry[]) {
    const result = await startTour(tourStops(steps, m.guide), m.guide.tour)
    if (result !== 'fallback') return
    setNotice({ stepId: steps[0].id, kind: 'targetMissing' })
    setOpen(true)
  }

  function showMe(stepId: GuideStepId) {
    const step = sections.flatMap((section) => section.steps).find((entry) => entry.id === stepId)
    const target = step ? guidePath(step.page, lastSiteId) : null
    if (!step || !target) return
    if (`${pathname}${search}` !== target.path) navigate(target.path)
    const outcome = showMeOutcome(target, isPhoneWidth())
    setNotice(outcome.notice ? { stepId, kind: outcome.notice } : null)
    setOpen(outcome.panel === 'open')
    if (outcome.spotlight) void spotlight([step])
  }

  function replayPage(pageId: GuidePageId) {
    const steps = stepsOnPage(sections, pageId)
    if (steps.length === 0) return
    const outcome = showMeOutcome({ path: pathname, needsSite: false }, isPhoneWidth())
    setNotice(outcome.notice ? { stepId: steps[0].id, kind: outcome.notice } : null)
    setOpen(outcome.panel === 'open')
    if (outcome.spotlight) void spotlight(steps)
  }

  return { lastSiteId, notice, clearNotice: () => setNotice(null), showMe, replayPage }
}
