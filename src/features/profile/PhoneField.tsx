import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { ChevronDownIcon } from '../../components/icons'
import { usePopover } from '../../components/popover'
import { useLocale } from '../../i18n'
import {
  countryOptions,
  defaultCountry,
  formatNational,
  joinPhone,
  searchCountries,
  splitPhone,
  type CountryCode,
  type CountryOption,
} from './phone'

type PhoneFieldProps = {
  /** Used as `field-{name}`, so the form can focus the number on an invalid submit. */
  name: string
  label: string
  /** Stored E.164 value; read once to fill the country and number. */
  value: string
  hint?: string
  error?: string
  valid?: boolean
  disabled?: boolean
  /** Receives E.164, or `''` while there is no country or no digits. */
  onChange: (value: string) => void
  onBlur?: () => void
}

/**
 * Phone number as a searchable country (dial code) plus the national number,
 * shown with the country's separators. The form only ever sees E.164.
 */
export function PhoneField({ name, label, value, hint, error, valid, disabled, onChange, onBlur }: PhoneFieldProps) {
  const { locale, messages: m } = useLocale()
  const t = m.profile.phoneField
  const [initial] = useState(() => splitPhone(value))
  const [country, setCountry] = useState<CountryCode | null>(initial.country ?? defaultCountry(navigator.languages))
  const [national, setNational] = useState(() => (initial.country ? formatNational(initial.national, initial.country) : ''))
  const [query, setQuery] = useState('')
  const { open, triggerRef, panelRef, panelId, toggle, close } = usePopover()
  const searchRef = useRef<HTMLInputElement>(null)
  const numberRef = useRef<HTMLInputElement>(null)
  const listId = useId()

  const countries = countryOptions(locale)
  const selected = countries.find((option) => option.code === country)
  const results = searchCountries(countries, query)

  const controlId = `field-${name}`
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const state = error ? 'invalid' : valid ? 'valid' : 'idle'

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  function togglePicker() {
    if (!open) setQuery('')
    toggle()
  }

  function choose(option: CountryOption) {
    setCountry(option.code)
    setNational((current) => formatNational(current.replace(/\D/g, ''), option.code))
    onChange(joinPhone(option.code, national))
    close(false)
    numberRef.current?.focus()
  }

  function typeNumber(text: string) {
    setNational(text)
    onChange(joinPhone(country, text))
  }

  function leaveNumber() {
    if (country) setNational(formatNational(national.replace(/\D/g, ''), country))
    onBlur?.()
  }

  // The modal also closes on Escape at the document; keep it open while only the list closes.
  function onPickerKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape' || !open) return
    event.nativeEvent.stopPropagation()
    close()
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (results[0]) choose(results[0])
    } else if (event.key === 'ArrowDown') {
      event.preventDefault()
      panelRef.current?.querySelector<HTMLButtonElement>('.popover__item')?.focus()
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    event.preventDefault()
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('.popover__item'))
    const index = items.indexOf(document.activeElement as HTMLButtonElement)
    const next = event.key === 'ArrowDown' ? index + 1 : index - 1
    if (next < 0) searchRef.current?.focus()
    else items[Math.min(next, items.length - 1)]?.focus()
  }

  return (
    <div className="form-field phone-field" data-state={state}>
      <label className="form-field__label" htmlFor={controlId}>
        {label}
      </label>
      <div className="phone-field__row">
        <div className="phone-field__country" onKeyDown={onPickerKeyDown}>
          <button
            ref={triggerRef}
            type="button"
            className="phone-field__trigger"
            aria-expanded={open}
            aria-controls={panelId}
            aria-label={selected ? `${t.country}: ${selected.name} +${selected.dialCode}` : t.chooseCountry}
            onClick={togglePicker}
            disabled={disabled}
          >
            <span>{selected ? `${selected.code} +${selected.dialCode}` : t.chooseCountry}</span>
            <ChevronDownIcon width="16" height="16" aria-hidden="true" />
          </button>
          <div ref={panelRef} id={panelId} className="popover phone-field__panel" hidden={!open}>
            <input
              ref={searchRef}
              type="search"
              className="phone-field__search"
              placeholder={t.search}
              aria-label={t.search}
              aria-controls={listId}
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
            />
            {results.length > 0 ? (
              <ul className="popover__list phone-field__list" id={listId} aria-label={t.countries} onKeyDown={onListKeyDown}>
                {results.map((option) => (
                  <li key={option.code}>
                    <button
                      type="button"
                      className="popover__item"
                      aria-current={option.code === country ? 'true' : undefined}
                      onClick={() => choose(option)}
                    >
                      <span className="popover__item-text">
                        <span className="popover__item-title">{option.name}</span>
                      </span>
                      <span className="phone-field__dial">+{option.dialCode}</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="phone-field__empty" role="status">
                {t.noResults}
              </p>
            )}
          </div>
        </div>
        <div className="form-field__box">
          <input
            ref={numberRef}
            className="form-field__control"
            id={controlId}
            name={name}
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={national}
            onChange={(event) => typeNumber(event.target.value)}
            onBlur={leaveNumber}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            disabled={disabled}
          />
          <span className="form-field__status" aria-hidden="true" />
        </div>
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
