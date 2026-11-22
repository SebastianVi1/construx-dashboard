import { describe, expect, it } from 'bun:test'
import type { Goal, GoalInput } from '../../../features/goals/goalsApi'
import { addPhase } from '../../../features/goals/phaseSave'
import { recordGuideMarks } from '../../support/guideMarks'

const marks = recordGuideMarks()
const input: GoalInput = { name: 'Cimentación', startAt: '2026-12-01T06:00:00Z', dueAt: '2027-01-15T06:00:00Z', color: '' }
const phase = { id: 'goal-1', name: 'Cimentación' } as Goal

describe('addPhase', () => {
  it('creates the phase and ticks "Create a phase" in its Company', async () => {
    const sent: unknown[] = []
    const created = await addPhase('org-1', 'site-1', input, async (...args) => {
      sent.push(args)
      return phase
    })
    expect(created).toBe(phase)
    expect(sent).toEqual([['org-1', 'site-1', input]])
    expect(marks).toEqual([{ stepId: 'create-phase', organizationId: 'org-1' }])
  })

  it('does not tick the step when the create fails, and passes the error on', async () => {
    const failure = new Error('400')
    await expect(
      addPhase('org-1', 'site-1', input, async () => {
        throw failure
      }),
    ).rejects.toBe(failure)
    expect(marks).toEqual([])
  })
})
