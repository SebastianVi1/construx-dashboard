import { z } from 'zod'
import { TEXT_LIMITS } from '../../components/form'
import type { Profile, ProfileUpdate } from './profileApi'

/** The editable part of a profile; the photo has its own flow. */
type EditableProfile = Pick<Profile, 'fullName' | 'phoneNumber' | 'trade'>

export type ProfileValidationMessages = {
  fullNameRequired: string
  fullNameMax: string
  phoneRequired: string
  phoneFormat: string
  tradeMax: string
}

export type ProfileValues = { fullName: string; phoneNumber: string; trade: string }

/** Within the backend's rules: full name 1..80, phone in E.164 (`+` and 2..15 digits), trade at most 60; all trimmed. */
export function makeProfileSchema(messages: ProfileValidationMessages) {
  return z.object({
    fullName: z.string().trim().min(1, messages.fullNameRequired).max(TEXT_LIMITS.personName, messages.fullNameMax),
    phoneNumber: z
      .string()
      .trim()
      .min(1, { message: messages.phoneRequired, abort: true })
      .regex(/^\+[1-9][0-9]{1,14}$/, messages.phoneFormat),
    trade: z.string().trim().max(TEXT_LIMITS.trade, messages.tradeMax),
  })
}

export function profileFormValues(profile: EditableProfile): ProfileValues {
  return { fullName: profile.fullName ?? '', phoneNumber: profile.phoneNumber ?? '', trade: profile.trade ?? '' }
}

/** PUT body: trimmed values; an empty trade clears the stored one. */
export function buildProfileUpdate(values: ProfileValues): ProfileUpdate {
  return { fullName: values.fullName.trim(), phoneNumber: values.phoneNumber.trim(), trade: values.trade.trim() }
}

export type ProfileField = keyof ProfileUpdate

export type ProfileChange = { field: ProfileField; from: string; to: string }

/** What a save would change, in form order; an unset stored field counts as empty. */
export function profileChanges(profile: EditableProfile, update: ProfileUpdate): ProfileChange[] {
  const fields: ProfileField[] = ['fullName', 'phoneNumber', 'trade']
  return fields
    .map((field) => ({ field, from: profile[field] ?? '', to: update[field] }))
    .filter((change) => change.from !== change.to)
}
