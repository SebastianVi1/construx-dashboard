import type { FormEvent, ReactNode } from 'react'

export type FieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'tel'
  | 'number'
  | 'url'
  | 'search'
  | 'date'
  | 'datetime-local'
  | 'select'

export type FieldOption = { value: string; label: string }

export type InputMode = 'text' | 'email' | 'numeric' | 'decimal' | 'tel' | 'url' | 'search'

/**
 * Declarative description of a single form field. `<Form>` renders one
 * `<Field>` per entry, and `name` keys into the controller's `values` and
 * `errors`. This is the "values as attributes" surface: placeholder, type,
 * autocomplete, and friends are plain props instead of hand-written JSX.
 */
export type FieldConfig = {
  /** Unique field name; used as the input `name` and to key values/errors. */
  name: string
  /** Visible label rendered above the control. */
  label: string
  /** Native input type. Defaults to `text`. */
  type?: FieldType
  /** Placeholder shown while the field is empty. */
  placeholder?: string
  /** Native autocomplete hint (e.g. `email`, `current-password`). */
  autoComplete?: string
  /** Native input mode for on-screen keyboards. */
  inputMode?: InputMode
  /** Force spell-check on/off for the control. */
  spellCheck?: boolean
  /** Helper text shown under the control while it is valid. */
  hint?: string
  /** Accessible names for the show/hide toggle. Only used by `password` fields. */
  revealLabels?: { show: string; hide: string }
  /** Choices of a `select` field, in display order. Use `value: ''` for "none". */
  options?: FieldOption[]
}

export type FieldErrors = Record<string, string | undefined>

/**
 * The logic half of a form, produced by `useForm` and consumed by `<Form>`.
 * Keeping values/errors/handlers here — instead of inside the UI — is what
 * separates logic from presentation.
 */
export type FormController = {
  values: Record<string, string>
  /** Errors visible to the user: only fields already touched or submitted. */
  errors: FieldErrors
  /** Fields that were visited (or submitted) and currently satisfy the schema. */
  valid: Record<string, boolean>
  isSubmitting: boolean
  submitError: boolean
  onChange: (name: string, value: string) => void
  onBlur: (name: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export type FormProps = {
  controller: FormController
  fields: FieldConfig[]
  /** Text of the submit button while idle. */
  submitLabel: string
  /** Text of the submit button while submitting. Falls back to `submitLabel`. */
  pendingLabel?: string
  /** Rendered between the fields and the submit button (alerts, status, etc.). */
  children?: ReactNode
}
