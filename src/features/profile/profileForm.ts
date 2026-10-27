import { z } from 'zod'
import type { Profile, ProfileUpdate } from './profileApi'

export type ProfileValidationMessages = {
  fullNameRequired: string
  fullNameMax: string
  phoneRequired: string
  phoneFormat: string
  tradeMax: string
}

export type ProfileValues = { fullName: string; phoneNumber: string; trade: string }

/** Backend rules: full name 1..160, phone in E.164 (`+` and 2..15 digits), trade at most 80; all trimmed. */
export function makeProfileSchema(messages: ProfileValidationMessages) {
  return z.object({
    fullName: z.string().trim().min(1, messages.fullNameRequired).max(160, messages.fullNameMax),
    phoneNumber: z
      .string()
      .trim()
      .min(1, { message: messages.phoneRequired, abort: true })
      .regex(/^\+[1-9][0-9]{1,14}$/, messages.phoneFormat),
    trade: z.string().trim().max(80, messages.tradeMax),
  })
}

export function profileFormValues(profile: Profile): ProfileValues {
  return { fullName: profile.fullName ?? '', phoneNumber: profile.phoneNumber ?? '', trade: profile.trade ?? '' }
}

/** PUT body: trimmed values; an empty trade clears the stored one. */
export function buildProfileUpdate(values: ProfileValues): ProfileUpdate {
  return { fullName: values.fullName.trim(), phoneNumber: values.phoneNumber.trim(), trade: values.trade.trim() }
}

export type ProfileField = keyof ProfileUpdate

export type ProfileChange = { field: ProfileField; from: string; to: string }

/** What a save would change, in form order; an unset stored field counts as empty. */
export function profileChanges(profile: Profile, update: ProfileUpdate): ProfileChange[] {
  const fields: ProfileField[] = ['fullName', 'phoneNumber', 'trade']
  return fields
    .map((field) => ({ field, from: profile[field] ?? '', to: update[field] }))
    .filter((change) => change.from !== change.to)
}
