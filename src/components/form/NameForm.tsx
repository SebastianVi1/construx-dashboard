import { z } from 'zod'
import { Field } from './Field'
import { useForm } from './useForm'
import './form.css'

type NameFormProps = {
  label: string
  maxLength: number
  messages: { required: string; max: string }
  submitLabel: string
  pendingLabel: string
  cancelLabel: string
  /** Server error from the last attempt, shown above the buttons. */
  error?: string | null
  /** Receives the trimmed name; rejects to keep the form open. */
  onSubmit: (name: string) => Promise<void>
  onCancel: () => void
}

/** One required name, such as a new folder's, with live validation and a submit that only fires once. */
export function NameForm({ label, maxLength, messages, submitLabel, pendingLabel, cancelLabel, error, onSubmit, onCancel }: NameFormProps) {
  const form = useForm({
    initialValues: { name: '' },
    schema: z.object({ name: z.string().trim().min(1, messages.required).max(maxLength, messages.max) }),
    onSubmit: (values) => onSubmit(values.name.trim()),
  })
  const busy = form.isSubmitting

  return (
    <form className="inline-form" noValidate onSubmit={form.onSubmit} aria-busy={busy}>
      <Field
        config={{ name: 'name', label, autoComplete: 'off', maxLength }}
        value={form.values.name}
        error={form.errors.name}
        valid={form.valid.name}
        disabled={busy}
        onChange={(value) => form.onChange('name', value)}
        onBlur={() => form.onBlur('name')}
      />
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="inline-form__actions">
        <button className="button button--primary" type="submit" disabled={busy} aria-busy={busy}>
          {busy ? pendingLabel : submitLabel}
        </button>
        <button className="button button--ghost" type="button" onClick={onCancel} disabled={busy}>
          {cancelLabel}
        </button>
      </div>
    </form>
  )
}
