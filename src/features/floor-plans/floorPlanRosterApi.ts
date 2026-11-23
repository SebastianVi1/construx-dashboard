import { z } from 'zod'
import { getJson } from '../../lib/http'
import { sitePath } from '../../lib/apiPaths'
import { personSchema } from '../people/personSchema'
import { roleNamesSchema } from '../permissions/can'

/** Site staff, crews and active equipment a planner drags onto zones (needs MANAGE_PLAN). */
export const rosterSchema = z.object({
  people: z.array(
    personSchema.extend({
      membershipId: z.string().min(1),
      roleName: z.string().nullable(),
      /** The role per language (§5.11); optional so an older backend still parses. */
      roleNames: roleNamesSchema.nullable().optional(),
    }),
  ),
  crews: z.array(z.object({ id: z.string().min(1), name: z.string(), memberCount: z.number().int() })),
  equipment: z.array(z.object({ id: z.string().min(1), type: z.string(), identifier: z.string() })),
})
export type Roster = z.infer<typeof rosterSchema>

export function getFloorPlanRoster(orgId: string, siteId: string): Promise<Roster> {
  return getJson(`${sitePath(orgId, siteId)}/floor-plans/roster`, rosterSchema)
}
