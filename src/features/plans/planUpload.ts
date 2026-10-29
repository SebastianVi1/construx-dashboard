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
export const MAX_NAME_LENGTH = 120
export const MAX_DESCRIPTION_LENGTH = 500

export const planContentTypes = ['image/jpeg', 'image/png', 'image/webp'] as const

const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

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

/** Scales down so the long edge is at most `maxEdge`; never scales up. */
export function scaledSize(width: number, height: number, maxEdge = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

export function compressedFileName(name: string, type: string): string {
  const dot = name.lastIndexOf('.')
  const base = dot > 0 ? name.slice(0, dot) : name
  return `${base}.${extensions[type] ?? 'bin'}`
}

/** The compressed file only when it is a supported type and smaller than the original. */
export function pickSmaller(original: File, compressed: Blob | null): File {
  if (!compressed || compressed.size >= original.size) return original
  if (!(planContentTypes as readonly string[]).includes(compressed.type)) return original
  return new File([compressed], compressedFileName(original.name, compressed.type), { type: compressed.type })
}

/**
 * Re-encodes a large image as WebP in the browser, shrinking it to `MAX_EDGE` when needed.
 * Returns the original when it is small, cannot be decoded, or compressing does not make it smaller
 * (some browsers cannot encode WebP and hand back a PNG).
 */
export async function compressImage(file: File): Promise<File> {
  if (!shouldCompress(file.size)) return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  try {
    const { width, height } = scaledSize(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY))
    return pickSmaller(file, blob)
  } finally {
    bitmap.close()
  }
}
