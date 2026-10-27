import { useState } from 'react'
import type { FieldConfig } from './types'

type FieldProps = {
  config: FieldConfig
  value: string
  error?: string
  valid?: boolean
  disabled?: boolean
  onChange: (value: string) => void
  onBlur?: () => void
}

export function Field({ config, value, error, valid, disabled, onChange, onBlur }: FieldProps) {
  const {
    name,
    label,
    type = 'text',
    placeholder,
    autoComplete,
    inputMode,
    spellCheck,
    hint,
    revealLabels,
    options = [],
  } = config

  const [revealed, setRevealed] = useState(false)
  const canReveal = type === 'password' && Boolean(revealLabels)
  const controlId = `field-${name}`
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const state = error ? 'invalid' : valid ? 'valid' : 'idle'
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className="form-field" data-state={state} data-type={type}>
      <label className="form-field__label" htmlFor={controlId}>
        {label}
      </label>
      <div className="form-field__box">
        {type === 'select' ? (
          <select
            className="form-field__control"
            id={controlId}
            name={name}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            disabled={disabled}
          >
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        ) : (
        <input
          className="form-field__control"
          id={controlId}
          name={name}
          type={canReveal && revealed ? 'text' : type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          spellCheck={spellCheck}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          disabled={disabled}
        />
        )}
        {canReveal && revealLabels ? (
          <button
            type="button"
            className="form-field__reveal"
            onClick={() => setRevealed((current) => !current)}
            aria-pressed={revealed}
            aria-label={revealed ? revealLabels.hide : revealLabels.show}
            disabled={disabled}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
              <circle cx="12" cy="12" r="3" />
              {revealed ? null : <path d="M4 4l16 16" />}
            </svg>
          </button>
        ) : null}
        <span className="form-field__status" aria-hidden="true" />
      </div>
      {error ? (
        <p className="form-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="form-field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
