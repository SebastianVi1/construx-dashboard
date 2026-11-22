import { describe, expect, it } from 'bun:test'
import {
  currentTourStep, firstUnfinishedTourStep, initialTourState, isTourStepDone,
  jumpableTourSteps, missingTourFacts, nextTourStep, tourPrefill, tourReducer,
  tourEntryCompletedBy, tourStepCompletedBy, tourStepStatus, type TourEvent, type TourState,
} from '../../../features/guide/tourState'
import type { TourCatalog, TourFacts, TourIds } from '../../../features/guide/tourCatalog'

const steps: TourCatalog<TourIds> = [
  { id: 'tour-a', page: 'sites', requires: [], doneWhen: 'hasCompany', tourTargets: ['a'], textKey: 'site' },
  { id: 'tour-b', page: 'sites', requires: ['hasCompany'], prefill: 'site', checklistStep: 'create-site', tourTargets: ['b'], textKey: 'site' },
  { id: 'tour-c', page: 'sites', requires: ['hasSite'], tourTargets: ['c'], textKey: 'site' },
  { id: 'tour-d', page: 'sites', requires: ['hasSite'], tourTargets: ['d'], textKey: 'site' },
]
const noFacts: TourFacts = { hasCompany: false, siteId: null }
const company: TourFacts = { hasCompany: true, siteId: null }
const site: TourFacts = { hasCompany: true, siteId: 'site-1' }
const initial = initialTourState as TourState<string>
const run = (state: TourState<string>, event: TourEvent<string>) => tourReducer(state, event, steps)

describe('tourReducer and selectors', () => {
  it('starts at the first unfinished step in catalog order and previews the next step', () => {
    expect(run(initial, { type: 'start', facts: noFacts }).current).toBe('tour-a')
    const started = run(initial, { type: 'start', facts: site })
    expect(started.current).toBe('tour-b')
    expect(currentTourStep(started, steps)?.id).toBe('tour-b')
    expect(firstUnfinishedTourStep([], company, steps)?.id).toBe('tour-b')
    expect(nextTourStep(started, site, steps)?.id).toBe('tour-c')
  })

  it('continues from the first unfinished step, including after leaving, without finishing when already done', () => {
    const started = run(initial, { type: 'start', facts: company })
    const left = run(started, { type: 'leave' })
    expect(run(left, { type: 'continue', facts: company }).current).toBe('tour-b')
    const allDone = { ...left, done: ['tour-a', 'tour-b', 'tour-c', 'tour-d'] }
    expect(run(allDone, { type: 'continue', facts: site })).toMatchObject({ active: false, current: null, finished: false })
    expect(nextTourStep(allDone, site, steps)).toBeNull()
  })

  it('replays the first step when start finds every step done', () => {
    const allDone = { ...initial, done: ['tour-a', 'tour-b', 'tour-c', 'tour-d'] }
    expect(run(allDone, { type: 'start', facts: site })).toMatchObject({ active: true, current: 'tour-a', replaying: true })
  })

  it('startAt enters jumpable steps, replays done steps, falls back from blocked steps, and ignores unknown ids', () => {
    expect(run(initial, { type: 'startAt', stepId: 'tour-b', facts: company })).toMatchObject({ current: 'tour-b', replaying: false })
    expect(run(initial, { type: 'startAt', stepId: 'tour-a', facts: company })).toMatchObject({ current: 'tour-a', replaying: true })
    expect(run(initial, { type: 'startAt', stepId: 'tour-c', facts: company }).current).toBe('tour-b')
    expect(run(initial, { type: 'startAt', stepId: 'unknown', facts: site })).toBe(initial)
  })

  it('jumps while inactive only when requirements hold, and reports missing facts', () => {
    expect(run(initial, { type: 'jump', stepId: 'tour-c', facts: site }).current).toBe('tour-c')
    expect(run(initial, { type: 'jump', stepId: 'tour-c', facts: company })).toBe(initial)
    expect(missingTourFacts(steps[2], company)).toEqual(['hasSite'])
    expect(jumpableTourSteps(initial, company, steps).map((step) => step.id)).toEqual(['tour-b'])
    expect(run(initial, { type: 'jump', stepId: 'unknown', facts: site })).toBe(initial)
  })

  it('replaying never requests a form or consumes a completion or failure', () => {
    const replay = run(initial, { type: 'jump', stepId: 'tour-b', facts: company })
    const done = run(replay, { type: 'hydrated', steps: { 'tour-b': 'COMPLETED' } })
    const again = run(done, { type: 'jump', stepId: 'tour-b', facts: company })
    expect(again.replaying).toBe(true)
    expect(tourPrefill(again, steps)).toBeNull()
    expect(tourStepCompletedBy(again, 'create-site', steps)).toBeNull()
    expect(run(again, { type: 'stepSucceeded', stepId: 'tour-b', facts: site })).toBe(again)
    expect(run(again, { type: 'stepFailed', stepId: 'tour-b' })).toBe(again)
  })

  it('success advances, records completion, resets form and error, and finishes after the last step', () => {
    const started = run(initial, { type: 'start', facts: company })
    const failed = run(started, { type: 'stepFailed', stepId: 'tour-b' })
    const used = run(failed, { type: 'prefillUsed' })
    const advanced = run(used, { type: 'stepSucceeded', stepId: 'tour-b', facts: site })
    expect(advanced).toMatchObject({ current: 'tour-c', done: ['tour-b'], prefillUsed: false, failed: false })
    const last = { ...advanced, current: 'tour-d', done: ['tour-b', 'tour-c'] }
    expect(run(last, { type: 'stepSucceeded', stepId: 'tour-d', facts: site })).toMatchObject({ active: false, current: null, finished: true })
    expect(run(started, { type: 'stepSucceeded', stepId: 'tour-c', facts: site })).toBe(started)
    expect(run(initial, { type: 'stepSucceeded', stepId: 'tour-b', facts: site })).toBe(initial)
  })

  it('failure leaves the current step pending and entering a step clears it', () => {
    const started = run(initial, { type: 'start', facts: company })
    const failed = run(started, { type: 'stepFailed', stepId: 'tour-b' })
    expect(failed).toMatchObject({ current: 'tour-b', failed: true, done: [] })
    expect(run(failed, { type: 'jump', stepId: 'tour-b', facts: company }).failed).toBe(false)
    expect(run(started, { type: 'stepFailed', stepId: 'tour-c' })).toBe(started)
  })

  it('offers site prefill once per entry and again after continue', () => {
    const started = run(initial, { type: 'start', facts: company })
    expect(tourPrefill(started, steps)).toBe('site')
    const used = run(started, { type: 'prefillUsed' })
    expect(tourPrefill(used, steps)).toBeNull()
    expect(tourPrefill(run(used, { type: 'continue', facts: company }), steps)).toBe('site')
    expect(run(initial, { type: 'prefillUsed' })).toBe(initial)
  })

  it('leave clears transient state and keeps completed steps', () => {
    const state = { ...initial, active: true, current: 'tour-b', replaying: true, prefillUsed: true, failed: true, done: ['tour-a'] }
    expect(run(state, { type: 'leave' })).toMatchObject({ active: false, current: null, replaying: false, prefillUsed: false, failed: false, done: ['tour-a'] })
  })

  it('hydrates only catalog ids and keeps session completions across late loads', () => {
    const loaded = run(initial, { type: 'hydrated', steps: { 'tour-b': 'COMPLETED', 'tour-c': 'SKIPPED', 'create-site': 'COMPLETED', other: 'SKIPPED' } })
    expect(loaded.done).toEqual(['tour-b', 'tour-c'])
    expect(run(loaded, { type: 'continue', facts: company }).current).toBe('tour-d')
    const session = { ...initial, done: ['tour-d'] }
    expect(run(session, { type: 'hydrated', steps: {} }).done).toEqual(['tour-d'])
  })

  it('counts doneWhen after a reload even without a saved tour step', () => {
    expect(isTourStepDone(steps[0], [], company)).toBe(true)
    expect(isTourStepDone(steps[0], [], noFacts)).toBe(false)
    expect(firstUnfinishedTourStep([], company, steps)?.id).toBe('tour-b')
  })

  it('reset restores initial state and finishSeen clears the end message', () => {
    const finished = { ...initial, finished: true }
    expect(run(finished, { type: 'finishSeen' }).finished).toBe(false)
    expect(run(finished, { type: 'reset' })).toEqual(initialTourState)
  })

  it('reports current, done and pending status including replay', () => {
    const state = { ...initial, active: true, current: 'tour-b', replaying: true, done: ['tour-c'] }
    expect(tourStepStatus(steps[1], state, company)).toBe('current')
    expect(tourStepStatus(steps[2], state, company)).toBe('done')
    expect(tourStepStatus(steps[3], state, company)).toBe('pending')
  })

  it('maps checklist or own-id marks only for the current active step', () => {
    const onB = run(initial, { type: 'start', facts: company })
    expect(tourStepCompletedBy(onB, 'create-site', steps)).toBe('tour-b')
    expect(tourStepCompletedBy(onB, 'tour-c', steps)).toBeNull()
    const onC = run(initial, { type: 'jump', stepId: 'tour-c', facts: site })
    expect(tourStepCompletedBy(onC, 'tour-c', steps)).toBe('tour-c')
    expect(tourStepCompletedBy(initial, 'create-site', steps)).toBeNull()
  })

  it('returns the current catalog entry for a checklist mark only while active and not replaying', () => {
    const onB = run(initial, { type: 'start', facts: company })
    const entry = tourEntryCompletedBy(onB, 'create-site', steps)
    expect(entry).toBe(steps[1])
    expect(entry?.id ?? null).toBe(tourStepCompletedBy(onB, 'create-site', steps))
    expect(tourEntryCompletedBy(initial, 'create-site', steps)).toBeNull()
    expect(tourEntryCompletedBy({ ...onB, replaying: true }, 'create-site', steps)).toBeNull()
    expect(tourEntryCompletedBy(onB, 'tour-c', steps)).toBeNull()
    expect(tourEntryCompletedBy(onB, 'unknown', steps)).toBeNull()
    const onC = run(initial, { type: 'jump', stepId: 'tour-c', facts: site })
    expect(tourEntryCompletedBy(onC, 'tour-c', steps)).toBe(steps[2])
    expect(tourEntryCompletedBy(onC, 'tour-c', steps)?.id ?? null).toBe(tourStepCompletedBy(onC, 'tour-c', steps))
  })
})
