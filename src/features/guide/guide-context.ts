import { createContext, useContext } from 'react'
import type { GuideProgress } from './guideApi'
import type { GuideCount, GuideSection } from './selection'
import type { GuideTours } from './useGuideTours'

export type GuideContextValue = {
  /** The member's checklist in this Company; empty when they have no steps. */
  sections: GuideSection[]
  /** This session's view of the saved progress (changes show before their saves finish). */
  progress: GuideProgress
  count: GuideCount
  /** Whether the member sees any open Site in this Company; null until a page has loaded their Sites. */
  hasSites: boolean | null
  /** The guide is hidden: no launcher, but the sidebar entry still opens it. */
  dismissed: boolean
  isOpen: boolean
  /** The launcher is showing (and the panel closed). */
  launcherVisible: boolean
  /** The last open step was done in this session and "You're set up" hasn't been seen yet. */
  justCompleted: boolean
  /** Open the panel; failed saves are sent again. */
  open: () => void
  close: () => void
  skip: (stepId: string) => void
  /** Hide the guide (the launcher goes away). */
  hide: () => void
  /** Bring the launcher back after hiding the guide. */
  show: () => void
  /** "You're set up" has been seen. */
  acknowledgeCompletion: () => void
} & Omit<GuideTours, 'clearNotice'>

export const GuideContext = createContext<GuideContextValue | undefined>(undefined)

export function useGuide(): GuideContextValue {
  const context = useContext(GuideContext)
  if (!context) throw new Error('useGuide must be used within a GuideProvider')
  return context
}
