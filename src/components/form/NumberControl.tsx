import { useLayoutEffect, useRef, type ChangeEvent, type InputHTMLAttributes } from 'react'
import { caretIndex, cleanNumber, groupDigits, padCents, type NumberRules } from './numberInput'

type NumberControlProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type'> &
  NumberRules & {
    /** The plain number as typed, without separators: "1234.5". */
    value: string
    onChange: (value: string) => void
    /** Money: thousands separators while typing and cents on blur. */
    money?: boolean
  }

/**
 * A text input that only takes a number. Re-formatting moves characters around, so the caret is put back
 * after the same digit it followed before.
 */
export function NumberControl({ value, onChange, onBlur, decimals, maxDigits, money = false, ...rest }: NumberControlProps) {
  const input = useRef<HTMLInputElement>(null)
  const caret = useRef<number | null>(null)
  const display = money ? groupDigits(value) : value

  useLayoutEffect(() => {
    const element = input.current
    if (caret.current === null || !element || document.activeElement !== element) return
    const index = caretIndex(display, caret.current)
    element.setSelectionRange(index, index)
    caret.current = null
  })

  function change(event: ChangeEvent<HTMLInputElement>) {
    const element = event.target
    const rules = { decimals, maxDigits }
    const cleaned = cleanNumber(element.value, rules)
    caret.current = cleanNumber(element.value.slice(0, element.selectionStart ?? element.value.length), rules).length
    if (cleaned === value) {
      // A rejected key leaves the value as it was, so React will not re-render: undo it here.
      element.value = display
      const index = caretIndex(display, caret.current)
      element.setSelectionRange(index, index)
      caret.current = null
      return
    }
    onChange(cleaned)
  }

  return (
    <input
      {...rest}
      ref={input}
      type="text"
      inputMode={decimals > 0 ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={display}
      onChange={change}
      onBlur={(event) => {
        if (money && value !== padCents(value)) onChange(padCents(value))
        onBlur?.(event)
      }}
    />
  )
}
