import { describe, expect, it } from 'bun:test'
import {
  markGuideStep,
  reportGuideSites,
  subscribeGuideSites,
  subscribeGuideSteps,
  type GuideMark,
  type GuideSitesReport,
  requestGuidePreview,
  subscribeGuidePreview,
  requestGuidedTour,
  subscribeGuidedTour,
} from '../../../features/guide/guideEvents'

describe('guide step events', () => {
  it('carries the created Site id only when provided', () => {
    const received: GuideMark[] = []
    const unsubscribe = subscribeGuideSteps((mark) => received.push(mark))
    markGuideStep('create-site', 'org-1', 'site-1')
    markGuideStep('site-details', 'org-1')
    unsubscribe()
    expect(received).toStrictEqual([
      { stepId: 'create-site', organizationId: 'org-1', createdId: 'site-1' },
      { stepId: 'site-details', organizationId: 'org-1' },
    ])
  })
  it('a listener receives each marked step', () => {
    const received: GuideMark[] = []
    const unsubscribe = subscribeGuideSteps((mark) => received.push(mark))

    markGuideStep('create-site', 'org-1')
    markGuideStep('invite-member', 'org-2')
    unsubscribe()

    expect(received).toEqual([
      { stepId: 'create-site', organizationId: 'org-1' },
      { stepId: 'invite-member', organizationId: 'org-2' },
    ])
  })

  it('always names the Company the action happened in', () => {
    // Checked by `bun run build`: the closure is never called.
    const checks = () => {
      // @ts-expect-error the Company is required
      markGuideStep('create-site')
      // @ts-expect-error the Company is never null
      const mark: GuideMark = { stepId: 'create-site', organizationId: null }
      return mark
    }
    expect(typeof checks).toBe('function')
  })

  it('a listener hears nothing after it unsubscribes', () => {
    const received: GuideMark[] = []
    const unsubscribe = subscribeGuideSteps((mark) => received.push(mark))
    unsubscribe()

    markGuideStep('create-site', 'org-1')

    expect(received).toEqual([])
  })

  it('unsubscribing one listener leaves the others listening', () => {
    const first: string[] = []
    const second: string[] = []
    const stopFirst = subscribeGuideSteps((mark) => first.push(mark.stepId))
    const stopSecond = subscribeGuideSteps((mark) => second.push(mark.stepId))

    stopFirst()
    markGuideStep('create-site', 'org-1')
    stopSecond()

    expect(first).toEqual([])
    expect(second).toEqual(['create-site'])
  })

  it('marking with no listener does nothing', () => {
    expect(() => markGuideStep('create-site', 'org-1')).not.toThrow()
  })
})

describe('guided tour requests', () => {
  it('delivers the requested step until unsubscribe', () => {
    const received: string[] = []
    const unsubscribe = subscribeGuidedTour((stepId) => received.push(stepId))
    requestGuidedTour('tour-site')
    unsubscribe()
    requestGuidedTour('tour-site')
    expect(received).toEqual(['tour-site'])
  })
})

describe('guide Site reports', () => {
  it('a listener receives each report until it unsubscribes, and hears no step marks', () => {
    const received: GuideSitesReport[] = []
    const unsubscribe = subscribeGuideSites((report) => received.push(report))

    reportGuideSites('org-1', false)
    markGuideStep('open-site', 'org-1')
    reportGuideSites('org-1', true)
    unsubscribe()
    reportGuideSites('org-1', false)

    expect(received).toEqual([
      { organizationId: 'org-1', hasSites: false },
      { organizationId: 'org-1', hasSites: true },
    ])
  })

  it('a step listener hears no Site reports, and reporting with no listener does nothing', () => {
    const marks: GuideMark[] = []
    const unsubscribe = subscribeGuideSteps((mark) => marks.push(mark))
    reportGuideSites('org-1', false)
    unsubscribe()

    expect(marks).toEqual([])
    expect(() => reportGuideSites('org-1', true)).not.toThrow()
  })
})

describe('guide preview requests', () => {
  it('a listener hears each request until it unsubscribes', () => {
    let heard = 0
    const unsubscribe = subscribeGuidePreview(() => heard++)
    requestGuidePreview()
    unsubscribe()
    requestGuidePreview()
    expect(heard).toBe(1)
  })
})
