import { Field } from './Field'
import type { FormProps } from './types'
import './form.css'

/**
 * Purely presentational. Given a `FormController` (logic) and a `fields`
 * config, it renders the whole form: one labelled control per field, any
 * injected status/alerts, and the submit button.
 */
export function Form({ controller, fields, submitLabel, pendingLabel, children }: FormProps) {
  const { values, errors, isSubmitting, onChange, onSubmit } = controller

  return (
    <form className="form" noValidate onSubmit={onSubmit} aria-busy={isSubmitting}>
      {fields.map((field) => (
        <Field
          key={field.name}
          config={field}
          value={values[field.name] ?? ''}
          error={errors[field.name]}
          disabled={isSubmitting}
          onChange={(value) => onChange(field.name, value)}
        />
      ))}

      {children}

      <button className="form-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting && pendingLabel ? pendingLabel : submitLabel}
      </button>
    </form>
  )
}
