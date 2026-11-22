import { guidePages, type GuideIds, type GuidePageEntry, type GuideStepEntry } from './catalog'
import type { GuideSection } from './selection'

/** Where a Site page sends the member when the guide knows no Site yet. */
export const SITES_LIST_PATH = '/sites'

const SITE_PLACEHOLDER = ':siteId'

/** App routes inside one Site: `/sites/:siteId/…` and `/documents/sites/:siteId/…`. */
const SITE_IN_PATH = /^\/(?:documents\/)?sites\/([^/]+)/

/** The Site a pathname is inside, or null on a Company page; feeds the guide's "last visited Site". */
export function siteIdInPath(pathname: string): string | null {
  const match = SITE_IN_PATH.exec(pathname)
  if (!match) return null
  try {
    return decodeURIComponent(match[1])
  } catch {
    return null
  }
}

export type GuidePath = {
  /** Where "Show me" goes. */
  path: string
  /** The page lives inside a Site and none is known yet: `path` is the Sites list instead. */
  needsSite: boolean
}

/**
 * Resolve a page entry to the path "Show me" opens: `:siteId` becomes the
 * remembered Site, and a Site page with no Site known falls back to the
 * Sites list with `needsSite`. Null for an unknown page id.
 */
export function guidePath(
  pageId: string,
  siteId: string | null,
  pages: readonly GuidePageEntry<GuideIds>[] = guidePages,
): GuidePath | null {
  const page = pages.find((entry) => entry.id === pageId)
  if (!page) return null
  if (!page.needsSite) return { path: page.route, needsSite: false }
  if (siteId === null) return { path: SITES_LIST_PATH, needsSite: true }
  return { path: page.route.replace(SITE_PLACEHOLDER, encodeURIComponent(siteId)), needsSite: false }
}

/** The member's steps on one page, in checklist order; the page's "?" replays them. */
export function stepsOnPage<I extends GuideIds>(sections: readonly GuideSection<I>[], pageId: I['page']): GuideStepEntry<I>[] {
  return sections.flatMap((section) => section.steps.filter((step) => step.page === pageId))
}

/**
 * A hint the panel shows under one step. `needsSite`: the step is inside a
 * Site and none is known, so the Sites list opened. `onPage` (phones): the
 * page opened and the step's text is the hint, as there is no spotlight.
 * `targetMissing`: the spotlight's target never showed.
 */
export type GuideNoticeKind = 'needsSite' | 'onPage' | 'targetMissing'

export type ShowMeOutcome = {
  /** The checklist after navigating: closed so the spotlight is visible, or open to show a hint. */
  panel: 'open' | 'closed'
  spotlight: boolean
  notice: GuideNoticeKind | null
}

/** What "Show me" does once it has navigated to `target`. Phones never get a spotlight. */
export function showMeOutcome(target: GuidePath, phone: boolean): ShowMeOutcome {
  if (target.needsSite) return { panel: 'open', spotlight: false, notice: 'needsSite' }
  if (phone) return { panel: 'open', spotlight: false, notice: 'onPage' }
  return { panel: 'closed', spotlight: true, notice: null }
}
