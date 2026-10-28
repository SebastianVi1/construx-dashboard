import { useId, type CSSProperties } from 'react'
import { Field } from '../../components/form'
import { useLocale } from '../../i18n'
import { barInk } from './barColor'
import './bar-color-picker.css'

/** Quick picks; the native picker beside them reaches any other color. */
const palette = [
  ['red', '#ef4444'],
  ['orange', '#f97316'],
  ['amber', '#f59e0b'],
  ['yellow', '#eab308'],
  ['lime', '#84cc16'],
  ['green', '#22c55e'],
  ['teal', '#14b8a6'],
  ['cyan', '#06b6d4'],
  ['blue', '#3b82f6'],
  ['indigo', '#6366f1'],
  ['purple', '#a855f7'],
  ['pink', '#ec4899'],
] as const

/** Where the native picker opens while the bar still has the default color. */
const PICKER_START = '#3b82f6'

const HEX = /^#[0-9a-fA-F]{6}$/

type BarColorPickerProps = {
  value: string
  disabled: boolean
  error?: string
  onChange: (color: string) => void
  onBlur: () => void
}

/** Part of the edit dialog's form: nothing is saved until the dialog is, and Cancel discards it. */
export function BarColorPicker({ value, disabled, error, onChange, onBlur }: BarColorPickerProps) {
  const { messages: m } = useLocale()
  const t = m.gantt
  const pickerId = useId()
  const color = HEX.test(value) ? value.toLowerCase() : undefined
  const preview = { '--bar-color': color } as CSSProperties
  return (
    <fieldset className="bar-color" disabled={disabled}>
      <legend>{t.barColor}</legend>
      <p className="bar-color__hint">{t.colorDialogHint}</p>
      <div className="bar-color__palette" role="group" aria-label={t.barColor}>
        {palette.map(([name, hex]) => (
          <button
            key={hex}
            type="button"
            className="bar-color__swatch"
            style={{ '--bar-color': hex } as CSSProperties}
            data-ink={barInk(hex)}
            aria-label={t.swatch[name]}
            title={t.swatch[name]}
            aria-pressed={color === hex}
            onClick={() => onChange(hex)}
          >
            {color === hex ? '✓' : null}
          </button>
        ))}
      </div>
      <div className="bar-color__custom">
        <label className="bar-color__picker" htmlFor={pickerId}>
          <input
            id={pickerId}
            type="color"
            value={color ?? PICKER_START}
            onChange={(event) => onChange(event.target.value)}
            onBlur={onBlur}
          />
          <span>{t.pickColor}</span>
        </label>
        <Field
          config={{ name: 'color', label: t.customColor, placeholder: '#3b82f6', autoComplete: 'off', spellCheck: false }}
          value={value}
          error={error}
          disabled={disabled}
          onChange={onChange}
          onBlur={onBlur}
        />
        <button type="button" className="button" disabled={disabled || !value} onClick={() => onChange('')}>
          {t.resetColor}
        </button>
      </div>
      <div className="bar-color__preview" style={preview} data-ink={color ? barInk(color) : undefined}>
        <span>{t.colorPreview}</span>
      </div>
    </fieldset>
  )
}
