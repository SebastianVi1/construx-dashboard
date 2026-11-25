import { z } from 'zod'
import { ApiError, getJson, sendJson } from '../../lib/http'
import { goalPath } from '../goals/goalsApi'
import type { PhaseRef } from './tasksApi'

/** Longest Progress note text the server accepts. */
export const progressNoteMaxLength = 1000

export const progressNoteSources = ['APP', 'WHATSAPP'] as const

export type ProgressNoteSource = (typeof progressNoteSources)[number]

/** Most photos one note holds. */
export const progressNoteMaxPhotos = 5

/** A photo of a note; `url` is a presigned download that expires after ten minutes. */
export const progressNotePhotoSchema = z.object({ id: z.string().min(1), url: z.string().min(1) })

/**
 * A dated entry on a task: text, photos or both. Never edited or deleted. `text` is null for photos only,
 * `author.name` is null without a profile name, `photos` are in the order they were sent.
 */
export const progressNoteSchema = z.object({
  id: z.string().min(1),
  text: z.string().nullable(),
  source: z.enum(progressNoteSources),
  author: z.object({ membershipId: z.string().min(1), name: z.string().nullable() }),
  createdAt: z.string(),
  photos: z.array(progressNotePhotoSchema),
})

export type ProgressNote = z.infer<typeof progressNoteSchema>

function notesPath(at: PhaseRef, taskId: string): string {
  return `${goalPath(at.organizationId, at.siteId, at.goalId)}/activities/${encodeURIComponent(taskId)}/progress-notes`
}

/** Newest first. Needs `VIEW_ACTIVITY` on the task. */
export function listProgressNotes(at: PhaseRef, taskId: string): Promise<ProgressNote[]> {
  return getJson(notesPath(at, taskId), z.array(progressNoteSchema))
}

/**
 * Writes a note from the app with the keys of photos already uploaded for this task. Blank text is left
 * out, so a note can be photos only. Needs `MANAGE_ACTIVITY` (team member for `OWN`).
 */
export function addProgressNote(at: PhaseRef, taskId: string, text: string, photoKeys: string[] = []): Promise<ProgressNote> {
  const trimmed = text.trim()
  return sendJson('post', notesPath(at, taskId), { ...(trimmed ? { text: trimmed } : {}), photoKeys }, 201, progressNoteSchema)
}

export const notePhotoUploadSchema = z.object({
  key: z.string().min(1),
  uploadUrl: z.string().min(1),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.string(),
})

export type NotePhotoUpload = z.infer<typeof notePhotoUploadSchema>

/** Step 1 of a photo upload: a presigned PUT for a JPEG or PNG of this size. Same right as writing a note. */
export function requestProgressNotePhotoUpload(
  at: PhaseRef,
  taskId: string,
  contentType: string,
  sizeBytes: number,
): Promise<NotePhotoUpload> {
  return sendJson('post', `${notesPath(at, taskId)}/photo-uploads`, { contentType, sizeBytes }, 201, notePhotoUploadSchema)
}

export type NoteDraftError = 'empty' | 'tooLong' | 'tooManyPhotos'

/** What is wrong with a draft of `text` and `photoCount` photos before sending it, or null when it can be sent. */
export function noteDraftError(text: string, photoCount: number): NoteDraftError | null {
  const trimmed = text.trim()
  if (!trimmed && photoCount === 0) return 'empty'
  if (trimmed.length > progressNoteMaxLength) return 'tooLong'
  return photoCount > progressNoteMaxPhotos ? 'tooManyPhotos' : null
}

export type ProgressNoteErrorKind = NoteDraftError | 'photoInvalid' | 'forbidden' | 'notFound' | 'session' | 'generic'

const badRequestKinds: Record<string, ProgressNoteErrorKind> = {
  PROGRESS_NOTE_EMPTY: 'empty',
  PROGRESS_NOTE_TOO_MANY_PHOTOS: 'tooManyPhotos',
  PROGRESS_NOTE_PHOTO_INVALID: 'photoInvalid',
}

/** Message for a failed note request; any other 400 is the length limit, the only other body rule. */
export function progressNoteErrorKind(error: unknown): ProgressNoteErrorKind {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.status === 400) return badRequestKinds[error.code ?? ''] ?? 'tooLong'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}
