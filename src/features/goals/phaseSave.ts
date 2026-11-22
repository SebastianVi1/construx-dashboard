import { markGuideStep } from '../guide'
import { createGoal, type Goal, type GoalInput } from './goalsApi'

/**
 * Create a phase on a Site. A new phase that was created ticks the guide's
 * "Create a phase" step; a failed create doesn't, and edits never come here.
 */
export async function addPhase(
  organizationId: string,
  siteId: string,
  input: GoalInput,
  create: typeof createGoal = createGoal,
): Promise<Goal> {
  const phase = await create(organizationId, siteId, input)
  markGuideStep('create-phase', organizationId)
  return phase
}
