/** Size in megabytes with one decimal, as shown next to file names. */
export function megabytes(bytes: number): string {
  return (bytes / (1024 * 1024)).toFixed(1)
}

/** True when a presigned view link has expired (or is about to, within `marginMs`). */
export function viewUrlExpired(expiresAt: string | null, now = Date.now(), marginMs = 15_000): boolean {
  if (!expiresAt) return true
  return Date.parse(expiresAt) - marginMs <= now
}
