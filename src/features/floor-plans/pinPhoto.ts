import { compressImage } from '../../lib/image'
import { sendToStorage } from '../plans/plansApi'
import { requestPinPhotoUpload } from './pinsApi'

/** Limits the API enforces; checked here first so a phone does not upload a photo that will be refused. */
export const MAX_PIN_PHOTOS = 10
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024
/** Long edge of a pin photo: enough to read a defect, small enough for a site connection. */
const PHOTO_EDGE = 2000

/** The photo is over 5 MB even after shrinking. */
export class PinPhotoTooLargeError extends Error {
  constructor() {
    super('Pin photo is too large')
    this.name = 'PinPhotoTooLargeError'
  }
}

/** A phone photo shrunk to 2000 px; the original comes back when the browser cannot re-encode it. */
export function shrinkPinPhoto(file: File): Promise<File> {
  return compressImage(file, { maxEdge: PHOTO_EDGE, quality: 0.8 })
}

/**
 * Shrink, presign and PUT one photo straight to storage. Resolves with the key a pin call then names;
 * until one does, the photo belongs to no pin.
 */
export async function uploadPinPhoto(
  organizationId: string,
  siteId: string,
  floorPlanId: string,
  original: File,
  {
    compress = shrinkPinPhoto,
    request = requestPinPhotoUpload,
    send = sendToStorage,
  }: { compress?: typeof shrinkPinPhoto; request?: typeof requestPinPhotoUpload; send?: typeof sendToStorage } = {},
): Promise<string> {
  const file = await compress(original)
  if (file.size > MAX_PHOTO_BYTES) throw new PinPhotoTooLargeError()
  const ticket = await request(organizationId, siteId, floorPlanId, file.type, file.size)
  await send(ticket, file, () => {})
  return ticket.key
}
