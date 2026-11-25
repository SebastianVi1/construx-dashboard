import { markGuideStep } from '../guide'
import { getWhatsAppStatus, type WhatsAppStatus } from './whatsappApi'

/** How often the card asks whether the code arrived. */
export const LINK_POLL_MS = 3000

/** Every digit but the last four is hidden. */
export function maskNumber(number: string): string {
  return `•••• ${number.replace(/\D/g, '').slice(-4)}`
}

/** Whole seconds until `expiresAt`, never below zero. */
export function secondsLeft(expiresAt: string, now: number): number {
  return Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000))
}

/** `m:ss`. */
export function formatCountdown(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

export type LinkProgress = 'waiting' | 'linked' | 'expired'

/** Polling goes on while `waiting`; a link that arrives counts even after the code ran out. */
export function linkProgress(status: WhatsAppStatus, expiresAt: string, now: number): LinkProgress {
  if (status.linked) return 'linked'
  return secondsLeft(expiresAt, now) > 0 ? 'waiting' : 'expired'
}

/** One poll of the link status; a linked number ticks the guide's "Link your WhatsApp" step. */
export async function checkWhatsAppLink(
  organizationId: string,
  read: typeof getWhatsAppStatus = getWhatsAppStatus,
): Promise<WhatsAppStatus> {
  const status = await read()
  if (status.linked) markGuideStep('link-whatsapp', organizationId)
  return status
}

/** SVG path of a QR matrix (from `uqr`'s `encode`): one unit square per dark module, x by column. */
export function qrPath(modules: readonly (readonly boolean[])[]): string {
  let path = ''
  modules.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) path += `M${x} ${y}h1v1h-1z`
    })
  })
  return path
}
