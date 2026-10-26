import { useRef, useState, type FormEvent } from 'react'
import type { ZodType } from 'zod'
import { collectErrors, visibleFieldState } from './validation'
import type { FieldErrors, FormController } from './types'

type UseFormOptions<Values extends Record<string, string>> = {
  initialValues: Values
  schema: ZodType<Values>
  onSubmit: (values: Values) => Promise<void>
  /** Called with the field errors after a failed validation. */
  onInvalid?: (errors: FieldErrors) => void
}

/**
 * Owns all form logic: values, validation, submission state, and the submit
 * handler. It renders nothing, so screens keep a single source of truth and
 * `<Form>` stays purely presentational.
 */
export function useForm<Values extends Record<string, string>>({
  initialValues,
  schema,
  onSubmit,
  onInvalid,
}: UseFormOptions<Values>): FormController {
  const [values, setValues] = useState<Values>(initialValues)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const submittingRef = useRef(false)

  // Derived on every render, so a rule that depends on another field (such as
  // "passwords match") reacts as soon as either value changes.
  const result = schema.safeParse(values)
  const allErrors: FieldErrors = result.success ? {} : collectErrors(result.error)

  const { errors, valid } = visibleFieldState(values, allErrors, touched, submitAttempted)

  function onChange(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
    setSubmitError(false)
  }

  function onBlur(name: string) {
    setTouched((current) => (current[name] ? current : { ...current, [name]: true }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    setSubmitAttempted(true)
    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      onInvalid?.(collectErrors(parsed.error))
      return
    }

    submittingRef.current = true
    setSubmitError(false)
    setIsSubmitting(true)
    try {
      await onSubmit(parsed.data)
    } catch {
      setSubmitError(true)
    } finally {
      submittingRef.current = false
      setIsSubmitting(false)
    }
  }

  return { values, errors, valid, isSubmitting, submitError, onChange, onBlur, onSubmit: handleSubmit }
}
