import { Field } from './Field'
import type { FormProps } from './types'
import './form.css'

/**
 * Purely presentational. Given a `FormController` (logic) and a `fields`
 * config, it renders the whole form: one labelled control per field, any
 * injected status/alerts, and the submit button.
 */
export function Form({
  controller,
  fields,
  submitLabel,
  pendingLabel,
  className,
  actionsClassName,
  submitClassName,
  submitDisabled = false,
  beforeSubmit,
  beforeFields,
  formRef,
  children,
}: FormProps) {
  const { values, errors, valid, isSubmitting, onChange, onBlur, onSubmit } = controller
  const submitButton = (
    <button
      className={submitClassName ?? 'form-submit'}
      type="submit"
      disabled={isSubmitting || submitDisabled}
      aria-busy={isSubmitting}
    >
      {isSubmitting && pendingLabel ? pendingLabel : submitLabel}
    </button>
  )
  const actions = beforeSubmit || actionsClassName
    ? <div className={actionsClassName}>{beforeSubmit}{submitButton}</div>
    : submitButton

  return (
    <form ref={formRef} className={['form', className].filter(Boolean).join(' ')} noValidate onSubmit={onSubmit} aria-busy={isSubmitting}>
      {beforeFields}
      {fields.map((field) => (
        <Field
          key={field.name}
          config={field}
          value={values[field.name] ?? ''}
          error={errors[field.name]}
          valid={valid[field.name]}
          disabled={isSubmitting}
          onChange={(value) => onChange(field.name, value)}
          onBlur={() => onBlur(field.name)}
        />
      ))}

      {children}

      {actions}
    </form>
  )
}
