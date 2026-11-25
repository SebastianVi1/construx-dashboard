import { MAX_PHOTO_BYTES, PinPhotoTooLargeError, shrinkPinPhoto } from '../floor-plans/pinPhoto'
import { sendToStorage } from '../plans/plansApi'
import { progressNoteMaxPhotos, requestProgressNotePhotoUpload } from './progressNotesApi'
import type { PhaseRef } from './tasksApi'

/** Limit the API enforces; checked here first so the form never offers a sixth photo. */
export const MAX_NOTE_PHOTOS = progressNoteMaxPhotos

/** The only image types a note photo may be; anything else is re-encoded as JPEG first. */
export const noteImageTypes = ['image/jpeg', 'image/png'] as const

/**
 * Shrink, presign and PUT one photo of a note straight to storage, like a pin photo. Resolves with the
 * key the note then names; until one does, the photo belongs to no note.
 */
export async function uploadNotePhoto(
  at: PhaseRef,
  taskId: string,
  original: File,
  {
    compress = shrinkPinPhoto,
    request = requestProgressNotePhotoUpload,
    send = sendToStorage,
  }: { compress?: typeof shrinkPinPhoto; request?: typeof requestProgressNotePhotoUpload; send?: typeof sendToStorage } = {},
): Promise<string> {
  const file = await compress(original, noteImageTypes)
  if (file.size > MAX_PHOTO_BYTES) throw new PinPhotoTooLargeError()
  const ticket = await request(at, taskId, file.type, file.size)
  await send(ticket, file, () => {})
  return ticket.key
}
