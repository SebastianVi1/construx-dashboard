import { z } from 'zod'
import { TEXT_LIMITS } from '../../components/form'

export type CrewValidationMessages = { nameRequired: string; nameMax: string; leaderRequired: string }

/** A crew needs a short name and a leader; the other people are picked outside the schema. */
export function makeCrewSchema(messages: CrewValidationMessages) {
  return z.object({
    name: z.string().trim().min(1, messages.nameRequired).max(TEXT_LIMITS.crewName, messages.nameMax),
    leader: z.string().min(1, messages.leaderRequired),
  })
}
