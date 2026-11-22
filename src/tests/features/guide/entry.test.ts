import { describe, expect, it } from 'bun:test'
import { entryProgress, guideEntry, progressText } from '../../../features/guide/entry'
import { guideMessages } from '../../../features/guide/messages'

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

describe('entryProgress', () => {
  const en = guideMessages.en

  it('gives the short counter and the spoken progress while steps are open', () => {
    expect(entryProgress({ done: 2, total: 5, complete: false }, en)).toEqual({ short: '2/5', label: '2 of 5 done' })
  })

  it('reads in Spanish too', () => {
    expect(entryProgress({ done: 0, total: 3, complete: false }, guideMessages.es)).toEqual({
      short: '0/3',
      label: '0 de 3 hechos',
    })
  })

  it('shows nothing once the guide is complete', () => {
    expect(entryProgress({ done: 5, total: 5, complete: true }, en)).toBeNull()
  })
})

describe('progressText', () => {
  it('gives the counter and the spoken progress, also once the guide is complete (launcher and panel)', () => {
    expect(progressText({ done: 5, total: 5 }, guideMessages.en)).toEqual({ short: '5/5', label: '5 of 5 done' })
    expect(progressText({ done: 1, total: 4 }, guideMessages.es)).toEqual({ short: '1/4', label: '1 de 4 hechos' })
  })
})
