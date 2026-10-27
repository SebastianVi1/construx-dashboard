import { z } from 'zod'
import { getJson, sendJson } from '../auth/authApi'

export const intents = ['RUN_COMPANY', 'WORKER_OR_INVITED'] as const
export const businessTypes = ['OWNER_DEVELOPER', 'GENERAL_CONTRACTOR', 'ARCHITECT_ENGINEER', 'SUBCONTRACTOR'] as const

export const intentSchema = z.enum(intents)
export const businessTypeSchema = z.enum(businessTypes)

export type Intent = z.infer<typeof intentSchema>
export type BusinessType = z.infer<typeof businessTypeSchema>

/** Body of `PUT /api/onboarding`. `intent` is required; `businessType` is optional. */
export type OnboardingAnswer = { intent: Intent; businessType: BusinessType | null }

export const onboardingStateSchema = z.object({
  intent: intentSchema.nullable(),
  businessType: businessTypeSchema.nullable(),
  updatedAt: z.string().nullable(),
})

export type OnboardingState = z.infer<typeof onboardingStateSchema>

/** The caller's answer; a user who never answered gets all-null fields. */
export function getOnboarding(): Promise<OnboardingState> {
  return getJson('/onboarding', onboardingStateSchema)
}

/** Idempotent upsert of the caller's answer. */
export function putOnboarding(answer: OnboardingAnswer): Promise<OnboardingState> {
  return sendJson(
    'put',
    '/onboarding',
    { intent: answer.intent, businessType: answer.businessType },
    200,
    onboardingStateSchema,
  )
}
