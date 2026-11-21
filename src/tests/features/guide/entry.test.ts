import { describe, expect, it } from 'bun:test'
import { guideEntry } from '../../../features/guide/entry'

const landing = 'https://construx.test/en/guide/#start'

describe('guideEntry', () => {
  it('opens the checklist for a member with steps, landing URL or not', () => {
    expect(guideEntry({ permissionsReady: true, hasSteps: true, landingHref: landing })).toEqual({ kind: 'panel' })
    expect(guideEntry({ permissionsReady: true, hasSteps: true, landingHref: null })).toEqual({ kind: 'panel' })
  })

  it('links a member with no steps (a Worker) to the landing guide', () => {
    expect(guideEntry({ permissionsReady: true, hasSteps: false, landingHref: landing })).toEqual({
      kind: 'landing',
      href: landing,
    })
  })

  it('hides the entry for a member with no steps when no landing URL is configured', () => {
    expect(guideEntry({ permissionsReady: true, hasSteps: false, landingHref: null })).toBeNull()
  })

  it('shows nothing until permissions load, so nobody briefly sees the Worker link', () => {
    expect(guideEntry({ permissionsReady: false, hasSteps: false, landingHref: landing })).toBeNull()
  })
})
