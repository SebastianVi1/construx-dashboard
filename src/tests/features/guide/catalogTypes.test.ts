import { describe, expect, it } from 'bun:test'
import type { ComponentProps, HTMLAttributes } from 'react'
import type { GuidePageId, GuideStepId, GuideTourTarget } from '../../../features/guide/catalog'
import type { GuideContextValue } from '../../../features/guide/guide-context'
import type { GuideHelpButton } from '../../../features/guide/GuideHelpButton'
import { markGuideStep } from '../../../features/guide/guideEvents'
import type { GuideSaves } from '../../../features/guide/guideSaves'
import { acceptsMark, type GuideAction } from '../../../features/guide/guideState'
import { selectGuide } from '../../../features/guide/selection'

/** What JSX accepts in a `data-tour` attribute. */
type DataTour = NonNullable<HTMLAttributes<HTMLElement>['data-tour']>

/**
 * The checks here are made by `bun run build` (tsc): a misspelt step, page or
 * tour target id must not compile. Each `@ts-expect-error` fails the build if
 * the line after it compiles. The closures are never called.
 */
describe('guide ids are typed from the catalog', () => {
  it('accepts the catalog ids', () => {
    const step: GuideStepId = 'create-site'
    const page: GuidePageId = 'site-details'
    const target: GuideTourTarget = 'finance-totals'
    expect([step, page, target]).toEqual(['create-site', 'site-details', 'finance-totals'])
  })

  it('rejects misspelt ids at every entry point', () => {
    const checks = (guide: GuideContextValue) => {
      // @ts-expect-error not a step id
      markGuideStep('create-sites', 'org-1')
      // @ts-expect-error not a step id
      guide.showMe('open-sites')
      // @ts-expect-error not a step id
      guide.skip('invite-members')
      // @ts-expect-error not a page id
      guide.replayPage('site')
      // @ts-expect-error not a page id
      const help: ComponentProps<typeof GuideHelpButton> = { page: 'phase' }
      const target: DataTour = 'site-create'
      // @ts-expect-error not a tour target
      const misspelt: DataTour = 'site-creat'
      return [help, target, misspelt]
    }
    expect(typeof checks).toBe('function')
  })

  it('rejects misspelt ids in the guide state and its saves', () => {
    const checks = (saves: GuideSaves) => {
      // @ts-expect-error not a step id
      saves.step('create-sites', 'COMPLETED')
      // @ts-expect-error not a step id
      const action: GuideAction = { type: 'marked', stepId: 'create-sites', status: 'COMPLETED', at: '', sections: [] }
      const progress = { started: false, steps: {}, dismissedAt: null, updatedAt: null }
      // @ts-expect-error not a step id of the built-in catalog
      return [action, acceptsMark(selectGuide(null), progress, 'create-sites', 'COMPLETED')]
    }
    expect(typeof checks).toBe('function')
  })
})
