import { describe, expect, it } from 'bun:test'
import {
  markGuideStep,
  reportGuideSites,
  subscribeGuideSites,
  subscribeGuideSteps,
  type GuideMark,
  type GuideSitesReport,
} from '../../../features/guide/guideEvents'

describe('guide step events', () => {
  it('a listener receives each marked step', () => {
    const received: GuideMark[] = []
    const unsubscribe = subscribeGuideSteps((mark) => received.push(mark))

    markGuideStep('create-site')
    markGuideStep('invite-member', 'org-1')
    unsubscribe()

    expect(received).toEqual([
      { stepId: 'create-site', organizationId: null },
      { stepId: 'invite-member', organizationId: 'org-1' },
    ])
  })

  it('a listener hears nothing after it unsubscribes', () => {
    const received: GuideMark[] = []
    const unsubscribe = subscribeGuideSteps((mark) => received.push(mark))
    unsubscribe()

    markGuideStep('create-site')

    expect(received).toEqual([])
  })

  it('unsubscribing one listener leaves the others listening', () => {
    const first: string[] = []
    const second: string[] = []
    const stopFirst = subscribeGuideSteps((mark) => first.push(mark.stepId))
    const stopSecond = subscribeGuideSteps((mark) => second.push(mark.stepId))

    stopFirst()
    markGuideStep('create-site')
    stopSecond()

    expect(first).toEqual([])
    expect(second).toEqual(['create-site'])
  })

  it('marking with no listener does nothing', () => {
    expect(() => markGuideStep('create-site')).not.toThrow()
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
