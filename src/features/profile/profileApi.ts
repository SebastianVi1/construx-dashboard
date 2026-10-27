import { z } from 'zod'
import { AuthApiError, getJson, sendJson } from '../auth/authApi'

/** `ProfileResponse`: every field is null until the person saves their profile. */
export const profileSchema = z.object({
  fullName: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  trade: z.string().nullable(),
})

export type Profile = z.infer<typeof profileSchema>

/** `PUT /api/profile` body: name and phone are required; `trade: ''` clears the trade. */
export type ProfileUpdate = { fullName: string; phoneNumber: string; trade: string }

export type ProfileErrorKind = 'invalid' | 'session' | 'generic'

/** The caller's own personal information. */
export function getProfile(): Promise<Profile> {
  return getJson('/profile', profileSchema)
}

/** Replace the caller's personal information. */
export function updateProfile(input: ProfileUpdate): Promise<Profile> {
  return sendJson('put', '/profile', input, 200, profileSchema)
}

export function profileErrorKind(error: unknown): ProfileErrorKind {
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.status === 400) return 'invalid'
  if (error.status === 401) return 'session'
  return 'generic'
}
