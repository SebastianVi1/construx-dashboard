import { z } from 'zod'
import { getJson } from '../auth/authApi'

/** `ProfileResponse`: every field is null until the person saves their profile. */
export const profileSchema = z.object({
  fullName: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  trade: z.string().nullable(),
})

export type Profile = z.infer<typeof profileSchema>

/** The caller's own personal information. */
export function getProfile(): Promise<Profile> {
  return getJson('/profile', profileSchema)
}
