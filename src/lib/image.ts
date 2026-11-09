/** Image types the browser can decode and the API stores. */
export const imageContentTypes = ['image/jpeg', 'image/png', 'image/webp'] as const

const extensions: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }

export type CompressOptions = {
  /** Long edge in pixels after compressing; smaller images are never scaled up. */
  maxEdge: number
  /** WebP quality, 0 to 1. */
  quality: number
  /** Files this small are returned as they are. */
  skipBelow?: number
}

/** Scales down so the long edge is at most `maxEdge`; never scales up. */
export function scaledSize(width: number, height: number, maxEdge: number): { width: number; height: number } {
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
  if (!(imageContentTypes as readonly string[]).includes(compressed.type)) return original
  return new File([compressed], compressedFileName(original.name, compressed.type), { type: compressed.type })
}

/**
 * Re-encodes an image as WebP in the browser, shrinking it to `maxEdge` when needed. WebP keeps lines
 * and text sharper than JPEG at the same size. Returns the original when it is under `skipBelow`,
 * cannot be decoded, or compressing does not make it smaller (some browsers cannot encode WebP and
 * hand back a PNG).
 */
export async function compressImage(file: File, { maxEdge, quality, skipBelow = 0 }: CompressOptions): Promise<File> {
  if (file.size < skipBelow) return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }
  try {
    const { width, height } = scaledSize(bitmap.width, bitmap.height, maxEdge)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return file
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, 0, 0, width, height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
    return pickSmaller(file, blob)
  } finally {
    bitmap.close()
  }
}
