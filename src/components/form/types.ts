import type { FormEvent, ReactNode, Ref } from 'react'

export type FieldType =
  | 'text'
  | 'email'
  | 'password'
  | 'tel'
  | 'number'
  | 'money'
  | 'url'
  | 'search'
  | 'date'
  | 'datetime-local'
  | 'select'
  | 'radio'
  | 'checkboxes'
  | 'textarea'

export type FieldOption = {
  value: string
  label: string
  disabled?: boolean
  checked?: boolean
  description?: string
  statusLabel?: string
}

export type FieldOptionGroup = {
  label?: string
  options: FieldOption[]
  className?: string
  labelClassName?: string
}

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
  /** Visible label rendered above the control or as its choice-group legend. */
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
  /** Options grouped under nested legends for radio and checkbox fields. */
  optionGroups?: FieldOptionGroup[]
  /** Class names for grouped choice controls and their visual labels. */
  groupClassName?: string
  groupLabelClassName?: string
  optionClassName?: string
  optionTextClassName?: string
  optionDescriptionClassName?: string
  optionStatusClassName?: string
  /** Minimum value for `date` or `datetime-local` inputs (YYYY-MM-DD). */
  min?: string
  /** Number of visible rows for `textarea` fields. */
  rows?: number
  /** Most characters a text field takes; a `textarea` also shows a counter. See `TEXT_LIMITS`. */
  maxLength?: number
  /** Decimal places a `number` field takes; 0 (the default) keeps it to whole numbers. Money always has 2. */
  decimals?: number
  /** Digits before the dot for `number` and `money` fields. See `MONEY_DIGITS`. */
  maxDigits?: number
  /** Unit shown after a `number` field's value, such as "m". */
  suffix?: string
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
  /** Extra class names for a screen-specific layout. */
  className?: string
  /** Class name for the action row around the submit button. */
  actionsClassName?: string
  /** Class name for the submit button. */
  submitClassName?: string
  /** Disable the submit button for a screen-specific unchanged or empty state. */
  submitDisabled?: boolean
  /** An optional control rendered before the submit button, such as Cancel. */
  beforeSubmit?: ReactNode
  /** Optional content rendered before the configured fields. */
  beforeFields?: ReactNode
  /** Ref for a screen-specific retry action that should submit the form again. */
  formRef?: Ref<HTMLFormElement>
  /** Rendered between the fields and the submit button (alerts, status, etc.). */
  children?: ReactNode
}
