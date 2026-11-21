import { describe, expect, it } from 'bun:test'
import { markGuideStep, subscribeGuideSteps, type GuideMark } from '../../../features/guide/guideEvents'

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
