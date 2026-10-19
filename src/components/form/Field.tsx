import type { FieldConfig } from './types'

type FieldProps = {
  config: FieldConfig
  value: string
  error?: string
  disabled?: boolean
  onChange: (value: string) => void
}

export function Field({ config, value, error, disabled, onChange }: FieldProps) {
  const {
    name,
    label,
    type = 'text',
    placeholder,
    autoComplete,
    inputMode,
    spellCheck,
    hint,
  } = config

  const controlId = `field-${name}`
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`

  return (
    <div className="form-field">
      <label className="form-field__label" htmlFor={controlId}>
        {label}
      </label>
      <input
        className="form-field__control"
        id={controlId}
        name={name}
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        spellCheck={spellCheck}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : hint ? hintId : undefined}
        disabled={disabled}
      />
      {!error && hint ? (
        <p className="form-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="form-field__error" id={errorId}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
