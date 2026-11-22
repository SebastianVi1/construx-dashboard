import { describe, expect, it } from 'bun:test'
import { guideVisibility, onboardingAnswer, type GuideVisibilityInput } from '../../../features/guide/visibility'

/** A member mid-way through a guide they have already seen. */
const midway: GuideVisibilityInput = {
  hasSteps: true,
  loaded: true,
  started: true,
  dismissed: false,
  complete: false,
  onboarding: 'answered',
}

const fresh: GuideVisibilityInput = { ...midway, started: false }

describe('guideVisibility: opening by itself', () => {
  it('opens a guide the member has never seen once onboarding is answered', () => {
    expect(guideVisibility(fresh).autoOpen).toBe(true)
  })

  it('does not open a guide the member has already seen (a reload, an existing member)', () => {
    expect(guideVisibility(midway).autoOpen).toBe(false)
    expect(guideVisibility({ ...midway, dismissed: true }).autoOpen).toBe(false)
  })

  it('waits for progress to load', () => {
    expect(guideVisibility({ ...fresh, loaded: false }).autoOpen).toBe(false)
  })

  it('waits until the onboarding question is answered, and while its answer is unknown', () => {
    expect(guideVisibility({ ...fresh, onboarding: 'unanswered' }).autoOpen).toBe(false)
    expect(guideVisibility({ ...fresh, onboarding: 'unknown' }).autoOpen).toBe(false)
  })

  it('never opens for a member with no steps', () => {
    expect(guideVisibility({ ...fresh, hasSteps: false }).autoOpen).toBe(false)
  })
})

describe('guideVisibility: the launcher', () => {
  it('shows for a started, unfinished guide that is not hidden', () => {
    expect(guideVisibility(midway).launcher).toBe(true)
  })

  it('hides when the guide is hidden or complete', () => {
    expect(guideVisibility({ ...midway, dismissed: true }).launcher).toBe(false)
    expect(guideVisibility({ ...midway, complete: true }).launcher).toBe(false)
  })

  it('hides while the onboarding question is still unanswered', () => {
    expect(guideVisibility({ ...midway, onboarding: 'unanswered' }).launcher).toBe(false)
  })

  it('hides while the onboarding answer is unknown (still loading, or the load failed)', () => {
    expect(guideVisibility({ ...midway, onboarding: 'unknown' }).launcher).toBe(false)
  })

  it('hides for a member with no steps, and until progress loads', () => {
    expect(guideVisibility({ ...midway, hasSteps: false }).launcher).toBe(false)
    expect(guideVisibility({ ...midway, loaded: false }).launcher).toBe(false)
  })
})

describe('onboardingAnswer', () => {
  it('is answered once the server returned an intent', () => {
    expect(onboardingAnswer('ready', 'RUN_COMPANY')).toBe('answered')
  })

  it('is unanswered when the server returned no intent', () => {
    expect(onboardingAnswer('ready', null)).toBe('unanswered')
  })

  it('is unknown while loading or after a failed load', () => {
    expect(onboardingAnswer('loading', null)).toBe('unknown')
    expect(onboardingAnswer('error', null)).toBe('unknown')
    expect(onboardingAnswer('idle', null)).toBe('unknown')
  })
})
