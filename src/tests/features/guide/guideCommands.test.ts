import { describe, expect, it } from 'bun:test'
import type { GuideStepId } from '../../../features/guide/catalog'
import type { GuideProgress, GuideStepStatus } from '../../../features/guide/guideApi'
import { guideCommands } from '../../../features/guide/guideCommands'
import { guideReducer, initialGuideState, shownProgress, type GuideAction, type GuideState } from '../../../features/guide/guideState'
import { selectGuide } from '../../../features/guide/selection'
import { seededRoles } from '../../support/seededRoles'

const at = '2026-11-21T09:00:00Z'
const sections = selectGuide(seededRoles.OWNER)
const real: GuideProgress = { started: true, steps: { 'create-site': 'COMPLETED' }, dismissedAt: null, updatedAt: at }

/** Runs commands against a live reducer and records what would be sent to the server. */
function harness(previewing: boolean) {
  let state: GuideState = guideReducer(initialGuideState, { type: 'loaded', progress: real, sections })
  if (previewing) state = guideReducer(state, { type: 'previewStarted' })
  const sent: string[] = []
  const saves = {
    step: (stepId: GuideStepId, status: GuideStepStatus) => sent.push(`step ${stepId} ${status}`),
    dismiss: (dismissed: boolean) => sent.push(`dismiss ${dismissed}`),
  }
  const dispatch = (action: GuideAction) => {
    state = guideReducer(state, action)
  }
  const commands = () => guideCommands({ state, sections, saves, dispatch, now: () => at })
  return { commands, sent, state: () => state }
}

describe('guideCommands', () => {
  it('saves skips, hides and real marks outside a preview', () => {
    const guide = harness(false)
    guide.commands().skip('invite-member')
    guide.commands().setDismissed(true)
    guide.commands().complete('site-details')
    expect(guide.sent).toEqual(['step invite-member SKIPPED', 'dismiss true', 'step site-details COMPLETED'])
    expect(guide.state().progress.steps).toMatchObject({ 'invite-member': 'SKIPPED', 'site-details': 'COMPLETED' })
  })

  it('sends nothing for a skip, hide or show while previewing', () => {
    const guide = harness(true)
    guide.commands().skip('create-site')
    guide.commands().setDismissed(true)
    guide.commands().setDismissed(false)
    expect(guide.sent).toEqual([])
    expect(shownProgress(guide.state()).steps).toEqual({ 'create-site': 'SKIPPED' })
    expect(guide.state().progress).toEqual(real)
  })

  it('still saves a step the member really did while previewing', () => {
    const guide = harness(true)
    guide.commands().complete('site-details')
    expect(guide.sent).toEqual(['step site-details COMPLETED'])
    expect(guide.state().progress.steps['site-details']).toBe('COMPLETED')
  })

  it('ignores a skip of a step the preview already shows skipped', () => {
    const guide = harness(true)
    guide.commands().skip('create-site')
    const before = guide.state()
    guide.commands().skip('create-site')
    expect(guide.state()).toBe(before)
  })
})
