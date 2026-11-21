import { guidePages, type GuidePageEntry, type GuideStepEntry } from './catalog'
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
export function guidePath(pageId: string, siteId: string | null, pages: GuidePageEntry[] = guidePages): GuidePath | null {
  const page = pages.find((entry) => entry.id === pageId)
  if (!page) return null
  if (!page.needsSite) return { path: page.route, needsSite: false }
  if (siteId === null) return { path: SITES_LIST_PATH, needsSite: true }
  return { path: page.route.replace(SITE_PLACEHOLDER, encodeURIComponent(siteId)), needsSite: false }
}

/** The member's steps on one page, in checklist order; the page's "?" replays them. */
export function stepsOnPage(sections: GuideSection[], pageId: string): GuideStepEntry[] {
  return sections.flatMap((section) => section.steps.filter((step) => step.page === pageId))
}
