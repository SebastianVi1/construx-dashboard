import { compressedFileName, imageContentTypes, scaledSize } from '../../lib/image'
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

/** The shrunk JPEG, unless the original is already an accepted image and no bigger. */
export function pickPinPhoto(original: File, shrunk: Blob | null): File {
  if (!shrunk) return original
  const accepted = (imageContentTypes as readonly string[]).includes(original.type)
  if (accepted && shrunk.size >= original.size) return original
  return new File([shrunk], compressedFileName(original.name, 'image/jpeg'), { type: 'image/jpeg' })
}

/**
 * A phone photo scaled to 2000 px and re-encoded as JPEG, which every browser can write (Safari cannot
 * write WebP and would hand back a PNG bigger than the photo). An image the browser cannot decode comes
 * back as it is and the API decides.
 */
export async function shrinkPinPhoto(file: File): Promise<File> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  try {
    const { width, height } = scaledSize(bitmap.width, bitmap.height, PHOTO_EDGE)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.8))
    return pickPinPhoto(file, blob)
  } finally {
    bitmap.close()
  }
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
