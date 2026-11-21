import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useLocale } from '../../i18n'
import type { GuideStepEntry } from './catalog'
import { guidePath, siteIdInPath, stepsOnPage } from './guidePaths'
import { readLastSite, rememberLastSite } from './lastSite'
import type { GuideSection } from './selection'
import { destroyActiveTour, isPhoneWidth, startTour, tourStops } from './tour'

/** A hint the panel shows under one step after "Show me". */
export type GuideNotice = {
  stepId: string
  /** `needsSite`: the step is inside a Site and none is known, so the Sites list opened. `targetMissing`: the spotlight's target never showed. */
  kind: 'needsSite' | 'targetMissing'
}

export type GuideTours = {
  /** The last Site visited in this Company (since the guide mounted, or remembered from before). */
  lastSiteId: string | null
  notice: GuideNotice | null
  clearNotice: () => void
  /** Open the step's page and spotlight its targets; on phones only navigate. */
  showMe: (stepId: string) => void
  /** Replay the tours of the member's steps on a page (the page's "?"). On phones, open the panel. */
  replayPage: (pageId: string) => void
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

  function showMe(stepId: string) {
    const step = sections.flatMap((section) => section.steps).find((entry) => entry.id === stepId)
    const target = step ? guidePath(step.page, lastSiteId) : null
    if (!step || !target) return
    if (`${pathname}${search}` !== target.path) navigate(target.path)
    if (target.needsSite) {
      setNotice({ stepId, kind: 'needsSite' })
      return
    }
    setNotice(null)
    setOpen(false)
    if (isPhoneWidth()) return
    void spotlight([step])
  }

  function replayPage(pageId: string) {
    const steps = stepsOnPage(sections, pageId)
    if (steps.length === 0) return
    setNotice(null)
    if (isPhoneWidth()) {
      setOpen(true)
      return
    }
    setOpen(false)
    void spotlight(steps)
  }

  return { lastSiteId, notice, clearNotice: () => setNotice(null), showMe, replayPage }
}
