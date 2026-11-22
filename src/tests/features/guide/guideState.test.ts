import { describe, expect, it } from 'bun:test'
import type { GuideProgress } from '../../../features/guide/guideApi'
import { acceptsMark, guideReducer, initialGuideState, shownProgress, type GuideState } from '../../../features/guide/guideState'
import { guideCatalog, type GuideIds, type GuideStepId } from '../../../features/guide/catalog'
import { guideProgressOf, selectGuide, type GuideSection } from '../../../features/guide/selection'
import { seededRoles } from '../../support/seededRoles'

const at = '2026-11-21T09:00:00Z'
const later = '2026-11-21T10:00:00Z'
const notStarted: GuideProgress = { started: false, steps: {}, dismissedAt: null, updatedAt: null }

function loaded(progress: GuideProgress): GuideState {
  return guideReducer(initialGuideState, { type: 'loaded', progress, sections: [] })
}

describe('guideReducer', () => {
  it('starts not loaded with empty progress', () => {
    expect(initialGuideState.loaded).toBe(false)
    expect(initialGuideState.progress).toEqual(notStarted)
  })

  it('takes the server progress on load', () => {
    const server: GuideProgress = { started: true, steps: { 'create-site': 'SKIPPED' }, dismissedAt: at, updatedAt: at }
    expect(loaded(server)).toMatchObject({ loaded: true, progress: server })
  })

  it('a mark ticks the step off and starts the guide', () => {
    const state = guideReducer(loaded(notStarted), { type: 'marked', stepId: 'create-site', status: 'COMPLETED', at, sections: [] })
    expect(state.progress.started).toBe(true)
    expect(state.progress.steps).toEqual({ 'create-site': 'COMPLETED' })
  })

  it('a later completion replaces a skip, but a skip never undoes a completion', () => {
    const skipped = guideReducer(loaded(notStarted), { type: 'marked', stepId: 'create-site', status: 'SKIPPED', at, sections: [] })
    const completed = guideReducer(skipped, { type: 'marked', stepId: 'create-site', status: 'COMPLETED', at, sections: [] })
    expect(completed.progress.steps['create-site']).toBe('COMPLETED')
    const again = guideReducer(completed, { type: 'marked', stepId: 'create-site', status: 'SKIPPED', at, sections: [] })
    expect(again.progress.steps['create-site']).toBe('COMPLETED')
  })

  it('keeps marks made before progress loaded', () => {
    const early = guideReducer(initialGuideState, { type: 'marked', stepId: 'create-site', status: 'COMPLETED', at, sections: [] })
    const state = guideReducer(early, { type: 'loaded', progress: notStarted, sections: [] })
    expect(state.loaded).toBe(true)
    expect(state.progress.started).toBe(true)
    expect(state.progress.steps).toEqual({ 'create-site': 'COMPLETED' })
  })

  it('hiding twice keeps the first time, and showing clears it', () => {
    const hidden = guideReducer(loaded(notStarted), { type: 'dismissed', dismissed: true, at })
    expect(hidden.progress).toMatchObject({ started: true, dismissedAt: at })
    const again = guideReducer(hidden, { type: 'dismissed', dismissed: true, at: later })
    expect(again.progress.dismissedAt).toBe(at)
    expect(guideReducer(again, { type: 'dismissed', dismissed: false, at: later }).progress.dismissedAt).toBeNull()
  })

  it('keeps a hide or show chosen before progress loaded', () => {
    const early = guideReducer(initialGuideState, { type: 'dismissed', dismissed: true, at })
    const state = guideReducer(early, { type: 'loaded', progress: notStarted, sections: [] })
    expect(state.progress.dismissedAt).toBe(at)
  })
})

describe('guideReducer: "You\'re set up"', () => {
  const step = (id: string) => guideCatalog.steps.find((entry) => entry.id === id)!
  const [createSite, siteDetails] = [step('create-site'), step('site-details')]
  /** A member whose checklist is two steps. */
  const sections: GuideSection[] = [{ id: 'owner', titleKey: 'runCompany', steps: [createSite, siteDetails] }]
  const mark = (stepId: GuideStepId, status: 'COMPLETED' | 'SKIPPED' = 'COMPLETED') =>
    ({ type: 'marked', stepId, status, at, sections }) as const
  const load = (progress: GuideProgress) => ({ type: 'loaded', progress, sections }) as const
  const run = (...actions: Parameters<typeof guideReducer>[1][]) => actions.reduce(guideReducer, initialGuideState)

  it('is set when a mark does the last open step', () => {
    expect(run(load(notStarted), mark('create-site')).justCompleted).toBe(false)
    expect(run(load(notStarted), mark('create-site'), mark('site-details')).justCompleted).toBe(true)
  })

  it('counts a skip as doing the step', () => {
    expect(run(load(notStarted), mark('create-site'), mark('site-details', 'SKIPPED')).justCompleted).toBe(true)
  })

  it('is decided against the latest progress, not the progress at the last render', () => {
    const server: GuideProgress = { ...notStarted, started: true, steps: { 'create-site': 'COMPLETED' } }
    expect(run(load(server), mark('site-details')).justCompleted).toBe(true)
  })

  it('is not set when progress loads already complete', () => {
    const server: GuideProgress = { ...notStarted, started: true, steps: { 'create-site': 'COMPLETED', 'site-details': 'SKIPPED' } }
    expect(run(load(server)).justCompleted).toBe(false)
  })

  it('waits for progress to load when a mark arrives first, then is set if that mark finished the guide', () => {
    const early = run(mark('site-details'))
    expect(early.justCompleted).toBe(false)
    const server: GuideProgress = { ...notStarted, started: true, steps: { 'create-site': 'COMPLETED' } }
    expect(guideReducer(early, load(server)).justCompleted).toBe(true)
  })

  it('is not set when a mark that arrived before the load repeats what the server already had', () => {
    const server: GuideProgress = { ...notStarted, started: true, steps: { 'create-site': 'COMPLETED', 'site-details': 'COMPLETED' } }
    expect(run(mark('site-details'), load(server)).justCompleted).toBe(false)
  })

  it('is not set before the load when a mark alone would look like the end', () => {
    const oneStep: GuideSection[] = [{ id: 'owner', titleKey: 'runCompany', steps: [createSite] }]
    const state = guideReducer(initialGuideState, { type: 'marked', stepId: 'create-site', status: 'COMPLETED', at, sections: oneStep })
    expect(state.justCompleted).toBe(false)
  })

  it('clears once acknowledged', () => {
    const done = run(load(notStarted), mark('create-site'), mark('site-details'))
    expect(guideReducer(done, { type: 'acknowledged' }).justCompleted).toBe(false)
  })
})

describe('acceptsMark', () => {
  const sections = selectGuide(seededRoles.OWNER)

  it('accepts an open step the member can see', () => {
    expect(acceptsMark(sections, notStarted, 'create-site', 'COMPLETED')).toBe(true)
    expect(acceptsMark(sections, notStarted, 'create-site', 'SKIPPED')).toBe(true)
  })

  it('ignores steps the member cannot see and unknown ids', () => {
    expect(acceptsMark(selectGuide(seededRoles.WORKER), notStarted, 'create-site', 'COMPLETED')).toBe(false)
    expect(acceptsMark<GuideIds>(sections, notStarted, 'old-step', 'COMPLETED')).toBe(false)
  })

  it('ignores a step already completed, or already in the same status', () => {
    const completed: GuideProgress = { ...notStarted, started: true, steps: { 'create-site': 'COMPLETED' } }
    expect(acceptsMark(sections, completed, 'create-site', 'COMPLETED')).toBe(false)
    expect(acceptsMark(sections, completed, 'create-site', 'SKIPPED')).toBe(false)
    const skipped: GuideProgress = { ...notStarted, started: true, steps: { 'create-site': 'SKIPPED' } }
    expect(acceptsMark(sections, skipped, 'create-site', 'SKIPPED')).toBe(false)
  })

  it('accepts completing a skipped step', () => {
    const skipped: GuideProgress = { ...notStarted, started: true, steps: { 'create-site': 'SKIPPED' } }
    expect(acceptsMark(sections, skipped, 'create-site', 'COMPLETED')).toBe(true)
  })
})

describe('guide preview (dev "Start tour")', () => {
  const sections = selectGuide(seededRoles.OWNER)
  const real: GuideProgress = { started: true, steps: { 'create-site': 'COMPLETED', 'site-details': 'SKIPPED' }, dismissedAt: at, updatedAt: at }
  const previewing = () => guideReducer(loaded(real), { type: 'previewStarted' })

  it('shows every step open and the guide not hidden, whatever was saved', () => {
    const shown = shownProgress(previewing())
    expect(shown.steps).toEqual({})
    expect(shown.dismissedAt).toBeNull()
    const count = guideProgressOf(sections, shown)
    expect(count.done).toBe(0)
    expect(count.complete).toBe(false)
    expect(count.next?.id).toBe(sections[0].steps[0].id)
  })

  it('a skip in the preview shows only in the preview', () => {
    const skipped = guideReducer(previewing(), { type: 'previewMarked', stepId: 'invite-member', status: 'SKIPPED' })
    expect(shownProgress(skipped).steps).toEqual({ 'invite-member': 'SKIPPED' })
    expect(skipped.progress).toEqual(real)
  })

  it('a real mark while previewing updates the real progress, not the preview', () => {
    const marked = guideReducer(previewing(), { type: 'marked', stepId: 'invite-member', status: 'COMPLETED', at: later, sections })
    expect(marked.progress.steps['invite-member']).toBe('COMPLETED')
    expect(shownProgress(marked).steps).toEqual({})
  })

  it('leaving the preview shows the real progress again', () => {
    const skipped = guideReducer(previewing(), { type: 'previewMarked', stepId: 'invite-member', status: 'SKIPPED' })
    const left = guideReducer(skipped, { type: 'previewEnded' })
    expect(left.preview).toBeNull()
    expect(shownProgress(left)).toEqual(real)
  })

  it('shows the real progress when not previewing', () => {
    expect(shownProgress(loaded(real))).toEqual(real)
    expect(initialGuideState.preview).toBeNull()
  })
})
