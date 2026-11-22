import { z } from 'zod'
import { getJson, sendJson } from '../../lib/http'
import { organizationPath } from '../../lib/apiPaths'

export const guideStepStatusSchema = z.enum(['COMPLETED', 'SKIPPED'])

export type GuideStepStatus = z.infer<typeof guideStepStatusSchema>

/** `GET /api/organizations/{id}/guide`: the caller's own progress in one Company. */
export const guideProgressSchema = z.object({
  /** False until the member has a progress row: the only case where the guide opens by itself. */
  started: z.boolean(),
  steps: z.record(z.string(), guideStepStatusSchema),
  dismissedAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
})

export type GuideProgress = z.infer<typeof guideProgressSchema>

/** The API URL of a Company's guide progress (app routes are `guidePaths.ts`). */
function guideApiPath(organizationId: string): string {
  return `${organizationPath(organizationId)}/guide`
}

/** The caller's progress; never creates a row. */
export function getGuide(organizationId: string): Promise<GuideProgress> {
  return getJson(guideApiPath(organizationId), guideProgressSchema)
}

/** Record a step as completed or skipped. Safe to repeat; a new status replaces the old one. */
export function markGuideStepRemote(
  organizationId: string,
  stepId: string,
  status: GuideStepStatus,
): Promise<GuideProgress> {
  return sendJson(
    'put',
    `${guideApiPath(organizationId)}/steps/${encodeURIComponent(stepId)}`,
    { status },
    200,
    guideProgressSchema,
  )
}

/** Hide (`true`) or show (`false`) the guide. Either one creates the progress row. */
export function setGuideDismissed(organizationId: string, dismissed: boolean): Promise<GuideProgress> {
  return sendJson('put', guideApiPath(organizationId), { dismissed }, 200, guideProgressSchema)
}
