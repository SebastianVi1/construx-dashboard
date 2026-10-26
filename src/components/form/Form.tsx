import { Field } from './Field'
import type { FormProps } from './types'
import './form.css'

/**
 * Purely presentational. Given a `FormController` (logic) and a `fields`
 * config, it renders the whole form: one labelled control per field, any
 * injected status/alerts, and the submit button.
 */
export function Form({ controller, fields, submitLabel, pendingLabel, children }: FormProps) {
  const { values, errors, valid, isSubmitting, onChange, onBlur, onSubmit } = controller

  return (
    <form className="form" noValidate onSubmit={onSubmit} aria-busy={isSubmitting}>
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

      <button className="form-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting && pendingLabel ? pendingLabel : submitLabel}
      </button>
    </form>
  )
}
