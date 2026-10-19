import type { ZodError } from 'zod'

/**
 * Flattens the first Zod issue per top-level field into a `FieldErrors` map.
 * The UI never touches Zod directly; this is the single translation point
 * between a schema result and the field→message shape the form renders.
 */
export function collectErrors(error: ZodError): Record<string, string | undefined> {
  const errors: Record<string, string | undefined> = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field === 'string' && !errors[field]) {
      errors[field] = issue.message
    }
  }
  return errors
}
