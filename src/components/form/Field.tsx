import { useState, type CSSProperties } from 'react'
import { currencySymbol, ExchangeRateNote, useCurrency } from '../../currency'
import { MONEY_DIGITS } from './limits'
import { NumberControl } from './NumberControl'
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
    min,
    rows = 3,
    maxLength,
    decimals = 0,
    maxDigits,
    suffix,
  } = config
  const { currency } = useCurrency()

  const [revealed, setRevealed] = useState(false)
  const canReveal = type === 'password' && Boolean(revealLabels)
  const controlId = `field-${name}`
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const state = error ? 'invalid' : valid ? 'valid' : 'idle'
  const describedBy = error ? errorId : hint ? hintId : undefined
  const prefix = type === 'money' ? currencySymbol[currency] : undefined
  // Room for the currency symbol or unit inside the box.
  const affixStyle = {
    '--affix-prefix': prefix ? `${prefix.length}ch` : undefined,
    '--affix-suffix': suffix ? `${suffix.length}ch` : undefined,
  } as CSSProperties
  const common = {
    className: 'form-field__control',
    id: controlId,
    name,
    placeholder,
    onBlur,
    'aria-invalid': Boolean(error),
    'aria-describedby': describedBy,
    disabled,
  }

  return (
    <div
      className="form-field"
      data-state={state}
      data-type={type}
      data-prefix={prefix ? true : undefined}
      data-suffix={suffix ? true : undefined}
      style={affixStyle}
    >
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
        ) : type === 'textarea' ? (
          <textarea
            {...common}
            spellCheck={spellCheck}
            rows={rows}
            maxLength={maxLength}
            value={value}
            onChange={(event) => onChange(event.target.value)}
          />
        ) : type === 'money' || type === 'number' ? (
          <NumberControl
            {...common}
            value={value}
            onChange={onChange}
            money={type === 'money'}
            decimals={type === 'money' ? 2 : decimals}
            maxDigits={maxDigits ?? (type === 'money' ? MONEY_DIGITS.amount : 9)}
          />
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
          min={min}
          maxLength={maxLength}
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
        {prefix ? (
          <span className="form-field__affix form-field__affix--prefix" aria-hidden="true">
            {prefix}
          </span>
        ) : null}
        {suffix ? (
          <span className="form-field__affix form-field__affix--suffix" aria-hidden="true">
            {suffix}
          </span>
        ) : null}
        <span className="form-field__status" aria-hidden="true" />
      </div>
      <div className="form-field__footer">
        {error ? (
          <p className="form-field__error" id={errorId} role="alert">
            {error}
          </p>
        ) : hint ? (
          <p className="form-field__hint" id={hintId}>
            {hint}
          </p>
        ) : type === 'money' ? (
          <ExchangeRateNote className="form-field__hint" />
        ) : null}
        {type === 'textarea' && maxLength ? (
          <span className="form-field__counter" aria-hidden="true">
            {value.length}/{maxLength}
          </span>
        ) : null}
      </div>
    </div>
  )
}
