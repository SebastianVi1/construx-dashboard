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

/**
 * Decides what the user sees for each field. Errors and the "valid" mark only
 * appear once a field was touched (blurred) or a submit was attempted, but from
 * then on they follow the current values, so cross-field rules stay reactive.
 */
export function visibleFieldState(
  values: Record<string, string>,
  allErrors: Record<string, string | undefined>,
  touched: Record<string, boolean>,
  submitAttempted: boolean,
) {
  const errors: Record<string, string | undefined> = {}
  const valid: Record<string, boolean> = {}
  for (const name of Object.keys(values)) {
    if (!submitAttempted && !touched[name]) continue
    if (allErrors[name]) errors[name] = allErrors[name]
    else if (values[name] !== '') valid[name] = true
  }
  return { errors, valid }
}
