import { z } from 'zod'
import { AuthApiError } from '../auth/authApi'

export type OrganizationValidationMessages = { nameRequired: string; nameMax: string }

/** Company name: 1 to 160 characters after trimming, as the backend enforces. */
export function makeOrganizationSchema(messages: OrganizationValidationMessages) {
  return z.object({
    name: z.string().trim().min(1, messages.nameRequired).max(160, messages.nameMax),
  })
}

export type CreateErrorKind = 'invalidName' | 'session' | 'generic'

/** Which message to show when `POST /api/organizations` fails. */
export function createErrorKind(error: unknown): CreateErrorKind {
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.status === 400) return 'invalidName'
  if (error.status === 401) return 'session'
  return 'generic'
}
