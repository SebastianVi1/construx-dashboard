import { z } from 'zod'

/**
 * How the backend shows a person (`PersonDirectory.Person`): every payload that names someone
 * extends this, so the photo rule lives in one place.
 */
export const personSchema = z.object({
  /** Null until the person saves a profile. */
  fullName: z.string().nullable(),
  /** Presigned download URL valid for an hour; null without a photo or when the backend omits it. */
  avatarUrl: z.string().nullable().default(null),
})

export type Person = z.infer<typeof personSchema>
