import { describe, expect, it } from 'bun:test'
import type { GuideProgress } from '../../../features/guide/guideApi'
import { acceptsMark, guideReducer, initialGuideState, type GuideState } from '../../../features/guide/guideState'
import { selectGuide } from '../../../features/guide/selection'
import { seededRoles } from '../../support/seededRoles'

const at = '2026-11-21T09:00:00Z'
const later = '2026-11-21T10:00:00Z'
const notStarted: GuideProgress = { started: false, steps: {}, dismissedAt: null, updatedAt: null }

function loaded(progress: GuideProgress): GuideState {
  return guideReducer(initialGuideState, { type: 'loaded', progress })
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
    const state = guideReducer(loaded(notStarted), { type: 'marked', stepId: 'create-site', status: 'COMPLETED', at })
    expect(state.progress.started).toBe(true)
    expect(state.progress.steps).toEqual({ 'create-site': 'COMPLETED' })
  })

  it('a later completion replaces a skip, but a skip never undoes a completion', () => {
    const skipped = guideReducer(loaded(notStarted), { type: 'marked', stepId: 'create-site', status: 'SKIPPED', at })
    const completed = guideReducer(skipped, { type: 'marked', stepId: 'create-site', status: 'COMPLETED', at })
    expect(completed.progress.steps['create-site']).toBe('COMPLETED')
    const again = guideReducer(completed, { type: 'marked', stepId: 'create-site', status: 'SKIPPED', at })
    expect(again.progress.steps['create-site']).toBe('COMPLETED')
  })

  it('keeps marks made before progress loaded', () => {
    const early = guideReducer(initialGuideState, { type: 'marked', stepId: 'create-site', status: 'COMPLETED', at })
    const state = guideReducer(early, { type: 'loaded', progress: notStarted })
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
    const state = guideReducer(early, { type: 'loaded', progress: notStarted })
    expect(state.progress.dismissedAt).toBe(at)
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
    expect(acceptsMark(sections, notStarted, 'old-step', 'COMPLETED')).toBe(false)
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
