import { compressImage, imageContentTypes } from '../../lib/image'
import { TEXT_LIMITS } from '../../components/form'

const MB = 1024 * 1024

/** What the browser accepts before compressing. */
export const MAX_ORIGINAL_BYTES = 50 * MB
/** What the server accepts, after compressing. */
export const MAX_FINAL_BYTES = 20 * MB
/** Files this small are uploaded as they are. */
export const SKIP_COMPRESSION_BELOW = 1.5 * MB
/** Long edge after compressing; plans keep enough pixels for thin lines and small text. */
export const MAX_EDGE = 6000
/** WebP keeps lines and text sharper than JPEG at the same size. */
export const WEBP_QUALITY = 0.85
export const MAX_NAME_LENGTH = TEXT_LIMITS.documentName
export const MAX_DESCRIPTION_LENGTH = TEXT_LIMITS.longText

export const planContentTypes = imageContentTypes

export type PlanFileIssue = 'fileType' | 'tooLarge' | 'empty'

/** Checked as soon as a file is picked, before anything is compressed or sent. */
export function planFileIssue(file: { type: string; size: number }): PlanFileIssue | null {
  if (!(planContentTypes as readonly string[]).includes(file.type)) return 'fileType'
  if (file.size === 0) return 'empty'
  if (file.size > MAX_ORIGINAL_BYTES) return 'tooLarge'
  return null
}

export function planNameIssue(name: string): 'nameTooLong' | null {
  return name.trim().length > MAX_NAME_LENGTH ? 'nameTooLong' : null
}

export function planDescriptionIssue(description: string): 'descriptionTooLong' | null {
  return description.trim().length > MAX_DESCRIPTION_LENGTH ? 'descriptionTooLong' : null
}

export function shouldCompress(size: number): boolean {
  return size >= SKIP_COMPRESSION_BELOW
}

/** Compresses a large plan image; small ones are uploaded as they are. */
export function compressPlanImage(file: File): Promise<File> {
  return compressImage(file, { maxEdge: MAX_EDGE, quality: WEBP_QUALITY, skipBelow: SKIP_COMPRESSION_BELOW })
}
