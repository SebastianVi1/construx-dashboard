import { z } from 'zod'
import { ApiError, getJson, sendJson } from '../../lib/http'
import { goalPath } from '../goals/goalsApi'
import type { PhaseRef } from './tasksApi'

/** Longest Progress note text the server accepts. */
export const progressNoteMaxLength = 1000

export const progressNoteSources = ['APP', 'WHATSAPP'] as const

export type ProgressNoteSource = (typeof progressNoteSources)[number]

/** A dated entry on a task. Never edited or deleted. `author.name` is null without a profile name. */
export const progressNoteSchema = z.object({
  id: z.string().min(1),
  text: z.string().nullable(),
  source: z.enum(progressNoteSources),
  author: z.object({ membershipId: z.string().min(1), name: z.string().nullable() }),
  createdAt: z.string(),
})

export type ProgressNote = z.infer<typeof progressNoteSchema>

function notesPath(at: PhaseRef, taskId: string): string {
  return `${goalPath(at.organizationId, at.siteId, at.goalId)}/activities/${encodeURIComponent(taskId)}/progress-notes`
}

/** Newest first. Needs `VIEW_ACTIVITY` on the task. */
export function listProgressNotes(at: PhaseRef, taskId: string): Promise<ProgressNote[]> {
  return getJson(notesPath(at, taskId), z.array(progressNoteSchema))
}

/** Writes a note from the app. Needs `MANAGE_ACTIVITY` (team member for `OWN`). */
export function addProgressNote(at: PhaseRef, taskId: string, text: string): Promise<ProgressNote> {
  return sendJson('post', notesPath(at, taskId), { text: text.trim() }, 201, progressNoteSchema)
}

export type NoteDraftError = 'empty' | 'tooLong'

/** What is wrong with a draft before sending it, or null when it can be sent. */
export function noteDraftError(text: string): NoteDraftError | null {
  const trimmed = text.trim()
  if (!trimmed) return 'empty'
  return trimmed.length > progressNoteMaxLength ? 'tooLong' : null
}

export type ProgressNoteErrorKind = NoteDraftError | 'forbidden' | 'notFound' | 'session' | 'generic'

/** Message for a failed note request; any other 400 is the length limit, the only other body rule. */
export function progressNoteErrorKind(error: unknown): ProgressNoteErrorKind {
  if (!(error instanceof ApiError)) return 'generic'
  if (error.status === 400) return error.code === 'PROGRESS_NOTE_EMPTY' ? 'empty' : 'tooLong'
  if (error.status === 401) return 'session'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'notFound'
  return 'generic'
}
