import { useRef, useState, type FormEvent } from 'react'
import type { ZodType } from 'zod'
import { collectErrors } from './validation'
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
  const [errors, setErrors] = useState<FieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const submittingRef = useRef(false)

  function onChange(name: string, value: string) {
    setValues((current) => ({ ...current, [name]: value }))
    setErrors((current) => ({ ...current, [name]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submittingRef.current) return

    const parsed = schema.safeParse(values)
    if (!parsed.success) {
      const nextErrors = collectErrors(parsed.error)
      setErrors(nextErrors)
      onInvalid?.(nextErrors)
      return
    }

    submittingRef.current = true
    setErrors({})
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

  return { values, errors, isSubmitting, submitError, onChange, onSubmit: handleSubmit }
}
