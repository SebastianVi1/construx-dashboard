import { z } from 'zod'
import { AuthApiError, deleteJson, getJson, sendJson } from '../auth/authApi'
import { compressImage, ImageCompressionError, imageContentTypes } from '../../lib/image'
import { sendToStorage, StorageUploadError } from '../plans/plansApi'

/** `ProfileResponse`: every field is null until the person saves their profile. */
export const profileSchema = z.object({
  fullName: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  trade: z.string().nullable(),
  /** Presigned download URL valid for an hour; null without a photo. */
  avatarUrl: z.string().nullable().default(null),
})

export type Profile = z.infer<typeof profileSchema>

/** `PUT /api/profile` body: name and phone are required; `trade: ''` clears the trade. */
export type ProfileUpdate = { fullName: string; phoneNumber: string; trade: string }

export type ProfileErrorKind = 'invalid' | 'session' | 'generic'

export const AVATAR_TYPES = imageContentTypes
/** What the browser accepts before compressing. */
export const MAX_AVATAR_ORIGINAL_BYTES = 20 * 1024 * 1024
/** What the server accepts, after compressing. */
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024
/** Long edge of the stored photo; avatars are shown at 88 px at most, so this covers high-density screens. */
export const AVATAR_EDGE = 512

export type AvatarErrorKind = 'fileType' | 'tooLarge' | 'compressFailed' | 'invalid' | 'uploadFailed' | 'session' | 'generic'

const avatarUploadTicketSchema = z.object({
  key: z.string().min(1),
  uploadUrl: z.string().min(1),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
})

/** The caller's own personal information. */
export function getProfile(): Promise<Profile> {
  return getJson('/profile', profileSchema)
}

/** Replace the caller's personal information. */
export function updateProfile(input: ProfileUpdate): Promise<Profile> {
  return sendJson('put', '/profile', input, 200, profileSchema)
}

/** Why a picked photo cannot be used, checked before compressing; null when it is fine. */
export function avatarFileProblem(file: Pick<File, 'type' | 'size'>): AvatarErrorKind | null {
  if (!(AVATAR_TYPES as readonly string[]).includes(file.type)) return 'fileType'
  if (file.size > MAX_AVATAR_ORIGINAL_BYTES) return 'tooLarge'
  return null
}

/**
 * Every photo is shrunk to `AVATAR_EDGE` and re-encoded as WebP, whatever its size. Throws
 * `ImageCompressionError` when the browser cannot process it, rather than uploading the original.
 */
export function compressAvatar(file: File): Promise<File> {
  return compressImage(file, { maxEdge: AVATAR_EDGE, quality: 0.85, strict: true })
}

/** Compress, presign, PUT the bytes straight to storage, then point the profile at the new photo. */
export async function uploadAvatar(
  original: File,
  { compress = compressAvatar, send = sendToStorage }: { compress?: typeof compressAvatar; send?: typeof sendToStorage } = {},
): Promise<Profile> {
  const file = await compress(original)
  // A small original that WebP cannot beat is kept as is; it still has to fit the server limit.
  if (file.size > MAX_AVATAR_BYTES) throw new AvatarTooLargeError()
  const ticket = await sendJson(
    'post',
    '/profile/avatar/uploads',
    { contentType: file.type, sizeBytes: file.size },
    201,
    avatarUploadTicketSchema,
  )
  await send(ticket, file, () => {})
  return sendJson('put', '/profile/avatar', { key: ticket.key }, 200, profileSchema)
}

/** Remove the photo; the avatar falls back to initials. */
export function removeAvatar(): Promise<void> {
  return deleteJson('/profile/avatar')
}

/** The photo is still over `MAX_AVATAR_BYTES` after compressing. */
export class AvatarTooLargeError extends Error {
  constructor() {
    super('Profile photo too large')
    this.name = 'AvatarTooLargeError'
  }
}

export function avatarErrorKind(error: unknown): AvatarErrorKind {
  if (error instanceof ImageCompressionError) return 'compressFailed'
  if (error instanceof AvatarTooLargeError) return 'tooLarge'
  if (error instanceof StorageUploadError) return 'uploadFailed'
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.status === 400) return 'invalid'
  if (error.status === 401) return 'session'
  return 'generic'
}

export function profileErrorKind(error: unknown): ProfileErrorKind {
  if (!(error instanceof AuthApiError)) return 'generic'
  if (error.status === 400) return 'invalid'
  if (error.status === 401) return 'session'
  return 'generic'
}
