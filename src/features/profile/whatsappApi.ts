import { z } from 'zod'
import { ApiError, deleteJson, getJson, sendJson } from '../../lib/http'
import { locales } from '../../i18n/locale'

/** Language the bot speaks to a Linked number. */
export const whatsappLanguageSchema = z.enum(locales)

export type WhatsAppLanguage = z.infer<typeof whatsappLanguageSchema>

/** `GET /api/profile/whatsapp`. `number` is the full number; show it with `maskNumber`. */
export const whatsappStatusSchema = z.object({
  linked: z.boolean(),
  number: z.string().nullable(),
  language: whatsappLanguageSchema.nullable(),
  linkedAt: z.string().nullable(),
  /** The Construx number people send the code to; null when the server has none configured. */
  construxNumber: z.string().nullable(),
})

export type WhatsAppStatus = z.infer<typeof whatsappStatusSchema>

/** A one-time `CX-1234` code: valid ten minutes, once; `waMeUrl` opens WhatsApp with it typed in. */
export const linkCodeSchema = z.object({
  code: z.string().min(1),
  expiresAt: z.string(),
  construxNumber: z.string().nullable(),
  waMeUrl: z.string().min(1),
})

export type LinkCode = z.infer<typeof linkCodeSchema>

const path = '/profile/whatsapp'

export function getWhatsAppStatus(): Promise<WhatsAppStatus> {
  return getJson(path, whatsappStatusSchema)
}

/** A new code replaces any earlier one. The number keeps `language` once linked. */
export function createLinkCode(language: WhatsAppLanguage): Promise<LinkCode> {
  return sendJson('post', `${path}/link-code`, { language }, 201, linkCodeSchema)
}

/** Only for a linked number (`404 WHATSAPP_NOT_LINKED` otherwise). */
export function changeWhatsAppLanguage(language: WhatsAppLanguage): Promise<WhatsAppStatus> {
  return sendJson('put', `${path}/language`, { language }, 200, whatsappStatusSchema)
}

export function unlinkWhatsApp(): Promise<void> {
  return deleteJson(path)
}

export type WhatsAppErrorKind = 'notLinked' | 'session' | 'generic'

export function whatsappErrorKind(error: unknown): WhatsAppErrorKind {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.status === 404 && error.code === 'WHATSAPP_NOT_LINKED') return 'notLinked'
  if (error.status === 401) return 'session'
  return 'generic'
}

